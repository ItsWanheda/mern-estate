import mongoose from 'mongoose';
import Listing from '../models/listing.model.js';
import { errorHandler } from '../utils/error.js';
import { validateListing } from '../utils/validation.js';
import { deleteStoredImages } from '../utils/objectStorage.js';
import { signCursor, verifyCursor } from '../utils/security.js';

const cleanupStoredImages = async (req, urls) => {
  const errors = await deleteStoredImages(urls);
  if (errors.length) req.log?.warn({ count: errors.length }, 'failed to delete one or more Firebase Storage objects');
};

export const createListing = async (req, res, next) => {
  const validation = validateListing(req.body);
  if (!validation.valid) return next(errorHandler(400, validation.message));
  try {
    const listing = await Listing.create({ ...validation.value, userRef: req.user.id });
    return res.status(201).json(listing);
  } catch (error) { return next(error); }
};

export const deleteListing = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return next(errorHandler(400, 'Invalid listing id.'));
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return next(errorHandler(404, 'Listing not found!'));
    if (String(req.user.id) !== String(listing.userRef)) return next(errorHandler(403, 'You can only delete your own listings!'));
    await Listing.findByIdAndDelete(req.params.id);
    await cleanupStoredImages(req, listing.imageUrls);
    return res.status(200).json({ success: true, message: 'Listing has been deleted!' });
  } catch (error) { return next(error); }
};

export const updateListing = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return next(errorHandler(400, 'Invalid listing id.'));
  const validation = validateListing(req.body);
  if (!validation.valid) return next(errorHandler(400, validation.message));
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return next(errorHandler(404, 'Listing not found!'));
    if (String(req.user.id) !== String(listing.userRef)) return next(errorHandler(403, 'You can only update your own listings!'));
    const previousImages = listing.imageUrls;
    const updatedListing = await Listing.findByIdAndUpdate(req.params.id, { $set: validation.value }, { new: true, runValidators: true });
    const retainedImages = new Set(validation.value.imageUrls);
    await cleanupStoredImages(req, previousImages.filter((url) => !retainedImages.has(url)));
    return res.status(200).json(updatedListing);
  } catch (error) { return next(error); }
};

export const getListing = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return next(errorHandler(400, 'Invalid listing id.'));
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) return next(errorHandler(404, 'Listing not found!'));
    return res.status(200).json(listing);
  } catch (error) { return next(error); }
};

export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\export const escapeRegex = (value) => value.replace(/[.*+?^$\\{}()|[\\]\\\\]/g, '\\\\$&');');

const ALLOWED_SORTS = new Set(['createdAt', 'regularPrice', 'discountPrice', 'bedrooms', 'bathrooms', 'name']);
const NUMERIC_SORTS = new Set(['regularPrice', 'discountPrice', 'bedrooms', 'bathrooms']);

const encodeCursor = ({ value, id, sort, order }) => signCursor({ value, id: String(id), sort, order });

const decodeCursor = (cursor, sort, order) => {
  const parsed = verifyCursor(cursor);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (typeof parsed.id !== 'string' || !mongoose.isValidObjectId(parsed.id)) return null;
  if (typeof parsed.sort !== 'string' || parsed.sort !== sort) return null;
  if (parsed.order !== 1 && parsed.order !== -1) return null;

  let value = parsed.value;
  if (sort === 'createdAt') {
    if (typeof value !== 'string') return null;
    value = new Date(value);
    if (Number.isNaN(value.getTime())) return null;
  } else if (NUMERIC_SORTS.has(sort)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  } else if (sort === 'name') {
    if (typeof value !== 'string' || value.length > 100) return null;
  } else {
    return null;
  }

  if (parsed.order !== order) return null;
  return { value, id: parsed.id };
};

export const getListings = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 9, 1), 50);
    const startIndex = Math.min(Math.max(Number.parseInt(req.query.startIndex, 10) || 0, 0), 100000);
    const searchTerm = typeof req.query.searchTerm === 'string' ? req.query.searchTerm.trim().slice(0, 100) : '';
    const sort = ALLOWED_SORTS.has(req.query.sort) ? req.query.sort : 'createdAt';
    const order = req.query.order === 'asc' ? 1 : -1;
    const filter = {};

    if (searchTerm) filter.name = { $regex: escapeRegex(searchTerm), $options: 'i' };
    if (['true', 'false'].includes(req.query.offer)) filter.offer = req.query.offer === 'true';
    if (['true', 'false'].includes(req.query.furnished)) filter.furnished = req.query.furnished === 'true';
    if (['true', 'false'].includes(req.query.parking)) filter.parking = req.query.parking === 'true';
    if (['sale', 'rent'].includes(req.query.type)) filter.type = { $eq: req.query.type };

    const cursor = typeof req.query.cursor === 'string' ? decodeCursor(req.query.cursor, sort, order) : null;
    if (req.query.cursor && !cursor) return next(errorHandler(400, 'Invalid pagination cursor.'));

    const sortSpec = { [sort]: order, _id: order };
    if (cursor) {
      const operator = order === 1 ? '$gt' : '$lt';
      filter.$and = [
        { $or: [{ [sort]: { [operator]: cursor.value } }, { [sort]: cursor.value, _id: { [operator]: cursor.id } }] },
      ];
    }

    const query = Listing.find(filter).sort(sortSpec).limit(limit + 1).lean();
    if (!cursor && startIndex) query.skip(startIndex);

    const rows = await query;
    const hasMore = rows.length > limit;
    const listings = hasMore ? rows.slice(0, limit) : rows;

    res.setHeader('X-Has-More', String(hasMore));
    if (hasMore) {
      const last = listings[listings.length - 1];
      res.setHeader('X-Next-Cursor', encodeCursor({ value: last[sort], id: last._id, sort, order }));
    } else {
      res.setHeader('X-Next-Cursor', '');
    }

    return res.status(200).json(listings);
  } catch (error) { return next(error); }
};
