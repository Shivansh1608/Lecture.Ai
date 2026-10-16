import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load backend/.env no matter where the process is started from
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, max: 60 }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api', videoRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const port = process.env.PORT || 5000;

// Log GROQ key status on boot (never print the key itself)
const groqKey = process.env.GROQ_API_KEY;
if (!groqKey || groqKey.startsWith('gsk_your_key') || groqKey.trim().length < 16) {
  console.warn('[LecturAI] WARNING: GROQ_API_KEY is missing or is still the placeholder value. AI features will return errors. Get a free key at https://console.groq.com/keys and add it to backend/.env');
} else {
  console.log(`[LecturAI] GROQ_API_KEY loaded (ends …${groqKey.slice(-4)}). Model: ${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'}`);
}

connectDB().then(() => app.listen(port, '0.0.0.0', () => console.log(`LecturAI API on http://localhost:${port}`)));
