import mongoose from 'mongoose';
import { logger } from './logger.js';

const MONGODB_URI = process.env['MONGODB_URI'];

let isConnected = false;

export async function connectDB(): Promise<typeof mongoose | null> {
  if (isConnected) {
    return mongoose;
  }

  if (!MONGODB_URI) {
    logger.warn('MONGODB_URI not set — database connection skipped');
    return null;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    logger.info('Connected to MongoDB');
    return mongoose;
  } catch (error) {
    logger.error('MongoDB connection failed', error);
    return null;
  }
}

export { mongoose };
