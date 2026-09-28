import jwt from 'jsonwebtoken';
import { errorHandler } from './error.js';
import { AUTH_COOKIE } from './security.js';

export const verifyToken = (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return next(errorHandler(401, 'Unauthorized'));
  if (!process.env.JWT_SECRET) return next(errorHandler(500, 'Authentication is not configured.'));
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    if (!user?.id) return next(errorHandler(401, 'Invalid authentication token.'));
    req.user = user;
    return next();
  } catch {
    return next(errorHandler(401, 'Invalid or expired authentication token.'));
  }
};