import jwt from 'jsonwebtoken';
import { errorHandler } from './error.js';

export const verifyToken = (req, res, next) => {
  const authorization = req.get('Authorization') || '';
  const [scheme, token, ...extra] = authorization.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token || extra.length) {
    return next(errorHandler(401, 'Unauthorized'));
  }

  if (!process.env.JWT_SECRET) return next(errorHandler(500, 'Authentication is not configured.'));

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!user?.id) return next(errorHandler(401, 'Invalid authentication token.'));
    req.user = user;
    return next();
  } catch {
    return next(errorHandler(401, 'Invalid or expired authentication token.'));
  }
};
