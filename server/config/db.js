const mongoose = require('mongoose');

const LOCAL_URI = 'mongodb://127.0.0.1:27017/evalix';
let retryTimer = null;
let connecting = false;

/**
 * Connect to MongoDB and keep retrying in the background on failure.
 *
 * The local fallback is opt-in (MONGODB_ALLOW_LOCAL_FALLBACK=true) and never used in production:
 * silently switching from the configured cluster to an empty local database would make the API
 * and the job workers read and write the wrong data while reporting "connected".
 */
const connectDB = async () => {
  if (connecting || mongoose.connection.readyState === 1) return;
  connecting = true;
  clearTimeout(retryTimer);

  const uri = process.env.MONGODB_URI || LOCAL_URI;
  const options = {
    // Atlas replica-set discovery regularly needs more than 3s on a cold start.
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 15000,
    maxPoolSize: 25, // Optimized pool size per PM2 cluster worker
    minPoolSize: 5,
  };
  const allowLocalFallback =
    process.env.MONGODB_ALLOW_LOCAL_FALLBACK === 'true' && process.env.NODE_ENV !== 'production';

  try {
    const conn = await mongoose.connect(uri, options);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    if (allowLocalFallback && uri !== LOCAL_URI) {
      try {
        console.warn(`MongoDB connection failed (${error.message}); using local fallback ${LOCAL_URI}`);
        const localConn = await mongoose.connect(LOCAL_URI, options);
        console.log(`MongoDB Connected (local fallback): ${localConn.connection.host}`);
        return;
      } catch (_localErr) {
        // fall through to retry
      }
    }
    console.error(`MongoDB connection failed: ${error.message}`);
    console.error('The server will continue running. Retrying in 30 seconds...');
    retryTimer = setTimeout(() => void connectDB(), 30000);
    if (typeof retryTimer.unref === 'function') retryTimer.unref();
  } finally {
    connecting = false;
  }
};

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error(`MongoDB connection error: ${err}`);
});

// Helper to check if DB is ready
const isDBConnected = () => mongoose.connection.readyState === 1;

module.exports = { connectDB, isDBConnected };
