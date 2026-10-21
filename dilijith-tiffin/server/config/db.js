import mongoose from 'mongoose';
import dns from 'dns';

// Ensure DNS resolution for MongoDB Atlas SRV records works reliably across environments (e.g. Windows/macOS/Linux)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // If system prevents overriding DNS, proceed with default resolver
}

let isConnected = false;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables. Please check your .env file.');
  }

  const dbName = process.env.MONGODB_DB_NAME || 'dilijith_tiffin';

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = true;
    console.log(`[Database] MongoDB connected successfully to database: "${dbName}"`);
    return mongoose.connection;
  } catch (error) {
    isConnected = false;
    console.error('[Database] MongoDB connection failed:', error.message);
    throw error;
  }
}

export function isDbConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

export function getDbState() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
}
