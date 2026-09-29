import express from 'express';
import { verifyToken } from '../utils/verifyUser.js';
import { google, getSession, signOut, signin, signup } from '../controllers/auth.controller.js';

export const createAuthRouter = ({ authLimiter }) => {
  const router = express.Router();
  router.post('/signup', authLimiter, signup);
  router.post('/signin', authLimiter, signin);
  router.post('/google', authLimiter, google);
  router.post('/signout', signOut);
  router.get('/session', verifyToken, getSession);
  return router;
};
