import express from 'express';
import { google, signOut, signin, signup } from '../controllers/auth.controller.js';

export const createAuthRouter = ({ authLimiter }) => {
  const router = express.Router();
  router.post('/signup', authLimiter, signup);
  router.post('/signin', authLimiter, signin);
  router.post('/google', authLimiter, google);
  router.post('/signout', signOut);
  return router;
};
