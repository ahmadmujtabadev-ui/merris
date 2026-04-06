import mongoose from 'mongoose';
import { logger } from './logger.js';

// MONGODB_URI read inside connectDB() to ensure dotenv has loaded

let isConnected = false;

export async function connectDB(): Promise<typeof mongoose | null> {
  if (isConnected) {
    return mongoose;
  }

  const MONGODB_URI = process.env["MONGODB_URI"];
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
