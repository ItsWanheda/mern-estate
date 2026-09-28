import express from 'express';
import { google, signOut, signin, signup } from '../controllers/auth.controller.js';
import { createRateLimiter } from '../utils/rateLimit.js';

const router = express.Router();
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many authentication attempts. Please try again later.' });

router.post('/signup', authLimiter, signup);
router.post('/signin', authLimiter, signin);
router.post('/google', authLimiter, google);
router.get('/signout', signOut);

export default router;