import mongoose from 'mongoose';
let pending;
export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (pending) return pending;
  if (!process.env.MONGODB_URI) throw new Error('Database configuration missing.');
  mongoose.set('strictQuery', true);
  pending = mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || 'dilijith_tiffin',
    serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, maxPoolSize: 5,
  }).then(() => mongoose.connection).finally(() => { pending = undefined; });
  return pending;
}
export const isDbConnected = () => mongoose.connection.readyState === 1;
export const getDbState = () => ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
