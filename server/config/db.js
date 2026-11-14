const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/evalix';
  const options = {
    serverSelectionTimeoutMS: 3000,
    maxPoolSize: 25, // Optimized pool size per PM2 cluster worker
    minPoolSize: 5,
  };
  try {
    const conn = await mongoose.connect(uri, options);
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    if (uri !== 'mongodb://127.0.0.1:27017/evalix') {
      try {
        console.log('Attempting local MongoDB connection (mongodb://127.0.0.1:27017/evalix)...');
        const localConn = await mongoose.connect('mongodb://127.0.0.1:27017/evalix', options);
        isConnected = true;
        console.log(`MongoDB Connected (local fallback): ${localConn.connection.host}`);
        return;
      } catch (localErr) {
        // Continue to retry logic
      }
    }
    isConnected = false;
    console.error(`MongoDB connection failed: ${error.message}`);
    console.error('The server will continue running. Retrying in 30 seconds...');
    // Retry connection after 30 seconds
    setTimeout(connectDB, 30000);
  }
};

mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('MongoDB connected');
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error(`MongoDB connection error: ${err}`);
});

// Helper to check if DB is ready
const isDBConnected = () => {
  return mongoose.connection.readyState === 1;
};

module.exports = { connectDB, isDBConnected };
