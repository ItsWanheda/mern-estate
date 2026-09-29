import bcryptjs from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import { errorHandler } from '../utils/error.js';
import Listing from '../models/listing.model.js';
import { validateUserUpdate } from '../utils/validation.js';
import { clearAuthCookie } from '../utils/security.js';
import { deleteStoredImages } from '../utils/objectStorage.js';

const cleanupStoredImages = async (req, urls) => {
  const errors = await deleteStoredImages(urls);
  if (errors.length) req.log?.warn({ count: errors.length }, 'failed to delete one or more Firebase Storage objects');
};

export const test = (req, res) => res.json({ message: 'Api route is working!' });

export const updateUser = async (req, res, next) => {
  if (String(req.user.id) !== String(req.params.id)) return next(errorHandler(403, 'You can only update your own account!'));
  const validation = validateUserUpdate(req.body);
  if (!validation.valid) return next(errorHandler(400, validation.message));
  try {
    const updates = { ...validation.value };
    if (updates.password) updates.password = await bcryptjs.hash(updates.password, 12);
    const currentUser = await User.findById(req.params.id).select('avatar').lean();
    if (!currentUser) return next(errorHandler(404, 'User not found!'));
    const previousAvatar = currentUser.avatar;
    const updatedUser = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!updatedUser) return next(errorHandler(404, 'User not found!'));
    if (updates.avatar && updates.avatar !== previousAvatar) await cleanupStoredImages(req, [previousAvatar]);
    const { password: _pass, ...rest } = updatedUser.toObject();
    return res.status(200).json(rest);
  } catch (error) {
    if (error?.code === 11000) return next(errorHandler(409, 'Email or username is already in use.'));
    return next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  if (String(req.user.id) !== String(req.params.id)) return next(errorHandler(403, 'You can only delete your own account!'));
  try {
    const user = await User.findById(req.params.id).select('_id avatar').lean();
    if (!user) return next(errorHandler(404, 'User not found!'));

    const listings = await Listing.find({ userRef: req.params.id }).select('imageUrls').lean();
    const listingImageUrls = listings.flatMap((listing) => listing.imageUrls || []);
    await Listing.deleteMany({ userRef: req.params.id });
    await User.findByIdAndDelete(req.params.id);
    await cleanupStoredImages(req, [...listingImageUrls, user.avatar]);

    clearAuthCookie(res);
    return res.status(200).json({ success: true, message: 'User and their listings have been deleted!' });
  } catch (error) {
    return next(error);
  }
};

export const getUserListings = async (req, res, next) => {
  if (String(req.user.id) !== String(req.params.id)) return next(errorHandler(403, 'You can only view your own listings!'));
  try {
    const listings = await Listing.find({ userRef: req.params.id }).lean();
    return res.status(200).json(listings);
  } catch (error) { return next(error); }
};

export const getUser = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return next(errorHandler(400, 'Invalid user id.'));
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return next(errorHandler(404, 'User not found!'));
    return res.status(200).json(user);
  } catch (error) { return next(error); }
};