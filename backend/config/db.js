import mongoose from 'mongoose';
export async function connectDB() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing in backend/.env. Using default mongodb://127.0.0.1:27017/lecturai');
  }
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lecturai';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB connected successfully');
    try {
      await mongoose.connection.collection('videos').dropIndex('title_text_summary_text_keyPoints_text');
    } catch {}
  } catch (err) {
    console.error(`MongoDB connection failed (${uri}):`, err.message);
    console.error('Note: Ensure MongoDB is running locally (e.g., "net start MongoDB" / Docker) or use a free MongoDB Atlas URI in backend/.env');
    throw err;
  }
}
