import mongoose from 'mongoose';

const mcqSchema = new mongoose.Schema({
  question: String,
  options: [String],
  answer: Number,
  explanation: String,
  section: String, // "beginning" | "middle" | "end"
}, { _id: false });

const videoSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    videoId: { type: String, required: true },
    youtubeUrl: { type: String, required: true },
    title: String,
    thumbnail: String,
    language: { type: String, default: 'English' },
    transcript: { type: String, select: false },

    // AI-generated content (richer schema)
    summary: { type: String, default: '' },           // 500-800 word markdown
    keyPoints: { type: [String], default: [] },       // 15-20 items
    definitions: {                                     // 8-12 items
      type: [{ term: String, meaning: String }],
      default: [],
    },
    mcqs: { type: [mcqSchema], default: [] },         // exactly 10
    flashcards: {                                      // 10 items
      type: [{ term: String, definition: String }],
      default: [],
    },

    // Processing progress (polled by the UI during analysis)
    processingStatus: {
      type: String,
      enum: ['idle', 'processing', 'done', 'error'],
      default: 'idle',
    },
    processingLog: { type: [String], default: [] },   // real-time steps shown in terminal
    processingError: { type: String, default: '' },

    // Legacy field – kept so existing docs don't break; always false going forward
    isFallback: { type: Boolean, default: false },
  },
  { timestamps: true }
);

videoSchema.index(
  { title: 'text', summary: 'text', keyPoints: 'text' },
  { default_language: 'none', language_override: 'none' }
);
videoSchema.index({ userId: 1, videoId: 1 }, { unique: true });

export default mongoose.model('Video', videoSchema);
