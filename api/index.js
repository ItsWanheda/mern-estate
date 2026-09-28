import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import userRouter from './routes/user.route.js';
import authRouter from './routes/auth.route.js';
import listingRouter from './routes/listing.route.js';
import { securityHeaders } from './utils/security.js';

dotenv.config();

if (!process.env.MONGO || !process.env.JWT_SECRET) throw new Error('MONGO and JWT_SECRET environment variables are required.');

const app = express();
const __dirname = path.resolve();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ success: connected, database: connected ? 'connected' : 'unavailable', uptime: process.uptime() });
});

app.use('/api/user', userRouter);
app.use('/api/auth', authRouter);
app.use('/api/listing', listingRouter);

app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('*', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'), (error) => error && next(error));
});

app.use((err, req, res, next) => {
  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message = statusCode >= 500 && process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || 'Internal Server Error');
  if (statusCode >= 500) console.error(err);
  res.status(statusCode).json({ success: false, statusCode, message });
});

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => console.log('Server is running on port ' + port + '!'));

mongoose.connect(process.env.MONGO)
  .then(() => console.log('Connected to MongoDB!'))
  .catch((error) => { console.error('MongoDB connection failed:', error); process.exitCode = 1; });

const shutdown = async (signal) => {
  console.log(signal + ' received. Shutting down gracefully...');
  server.close(async () => { await mongoose.connection.close(); process.exit(0); });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;