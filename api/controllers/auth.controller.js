import crypto from 'crypto';
import User from '../models/user.model.js';
import bcryptjs from 'bcryptjs';
import { errorHandler } from '../utils/error.js';
import { signAccessToken } from '../utils/security.js';
import { validateSignup, validateSignin } from '../utils/validation.js';
import { getFirebaseAuth } from '../utils/firebaseAdmin.js';

export const signup = async (req, res, next) => {
  const validation = validateSignup(req.body);
  if (!validation.valid) return next(errorHandler(400, validation.message));
  const { username, email, password } = validation.value;
  try {
    const existing = await User.findOne({ $or: [{ email }, { username }] }).lean();
    if (existing) return next(errorHandler(409, existing.email === email ? 'Email is already registered.' : 'Username is already taken.'));
    await User.create({ username, email, password: await bcryptjs.hash(password, 12) });
    return res.status(201).json({ success: true, message: 'User created successfully!' });
  } catch (error) {
    if (error?.code === 11000) return next(errorHandler(409, 'Email or username is already in use.'));
    return next(error);
  }
};

export const signin = async (req, res, next) => {
  const validation = validateSignin(req.body);
  if (!validation.valid) return next(errorHandler(400, validation.message));
  const { email, password } = validation.value;
  try {
    const validUser = await User.findOne({ email });
    if (!validUser || !(await bcryptjs.compare(password, validUser.password))) return next(errorHandler(401, 'Invalid email or password.'));
    const token = signAccessToken(validUser._id);
    const { password: _pass, ...rest } = validUser.toObject();
    return res.status(200).json({ ...rest, token });
  } catch (error) { return next(error); }
};

export const google = async (req, res, next) => {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
  if (!idToken) return next(errorHandler(400, 'Google authentication token is required.'));

  try {
    const claims = await getFirebaseAuth().verifyIdToken(idToken);
    if (!claims.email_verified) return next(errorHandler(401, 'Google account email is not verified.'));

    const email = claims.email?.toLowerCase();
    if (!email) return next(errorHandler(401, 'Google account email is unavailable.'));

    const usernameBase = String(claims.name || email.split('@')[0] || 'user')
      .replace(/[^a-zA-Z0-9_.-]/g, '')
      .slice(0, 24) || 'user';

    let user = await User.findOne({ email });
    if (!user) {
      let username = usernameBase;
      for (let i = 0; await User.exists({ username }); i += 1) {
        username = (usernameBase + (i + 1)).slice(0, 30);
      }
      user = await User.create({
        username,
        email,
        password: await bcryptjs.hash(crypto.randomUUID() + crypto.randomUUID(), 12),
        avatar: claims.picture,
      });
    }

    const token = signAccessToken(user._id);
    const { password: _pass, ...rest } = user.toObject();
    return res.status(200).json({ ...rest, token });
  } catch (error) {
    if (error?.code?.startsWith?.('auth/')) return next(errorHandler(401, 'Invalid Google authentication token.'));
    return next(error);
  }
};

export const getSession = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return next(errorHandler(401, 'User account no longer exists.'));
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
};

export const signOut = async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, message: 'User has been logged out!' });
  } catch (error) { return next(error); }
};
