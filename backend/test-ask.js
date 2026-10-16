import mongoose from 'mongoose';
import Video from './models/Video.js';
import { topPassages } from './services/rag.js';
import { answerFromContext } from './services/ai.js';
import { chunkText } from './services/transcript.js';

await mongoose.connect('mongodb://127.0.0.1:27017/lecturai');
const video = await Video.findOne({ title: /HTML/ }).select('+transcript');
console.log('Video found:', video.title);

const testQueries = [
  'Explain the main idea in simple words',
  'What examples did the speaker give?',
  'Which terms should I remember for an exam?',
  'What is HTML?'
];

for (const q of testQueries) {
  let passages = topPassages(video.transcript, q);
  if (!passages.length) {
    if (video.summary || video.keyPoints?.length) {
      passages = [video.summary, (video.keyPoints || []).join('\n\n')].filter(Boolean);
    } else if (video.transcript) {
      passages = chunkText(video.transcript, 1200).slice(0, 2);
    }
  }
  console.log(`\nQuery: "${q}" -> Passages found: ${passages.length}`);
  const ans = await answerFromContext(q, passages);
  console.log(`Answer:\n${ans}`);
}

process.exit(0);
