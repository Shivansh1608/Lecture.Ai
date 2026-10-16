import { chunkText } from './transcript.js';

// Lightweight BM25 retrieval. No vector DB or embeddings needed, runs in-process.
const STOP = new Set('a an the is are was were be to of and or in on for with as by it this that from at which what how why who when'.split(' '));
const tokens = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));

export function topPassages(transcript, question, k = 4) {
  if (!transcript || !question || typeof transcript !== 'string') return [];
  const docs = chunkText(transcript, 1200);
  if (!docs.length) return [];
  const q = tokens(question);
  if (!q.length) return [];
  const tok = docs.map(tokens);
  const avg = tok.reduce((s, d) => s + d.length, 0) / (docs.length || 1);
  const df = {};
  tok.forEach((d) => new Set(d).forEach((w) => (df[w] = (df[w] || 0) + 1)));
  const k1 = 1.5, b = 0.75;
  const scored = tok.map((d, i) => {
    const tf = {};
    d.forEach((w) => (tf[w] = (tf[w] || 0) + 1));
    let score = 0;
    for (const w of q) {
      if (!tf[w]) continue;
      const idf = Math.log(1 + (docs.length - df[w] + 0.5) / (df[w] + 0.5));
      score += idf * ((tf[w] * (k1 + 1)) / (tf[w] + k1 * (1 - b + (b * d.length) / avg)));
    }
    return { i, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, k).filter((s) => s.score > 0).map((s) => docs[s.i]);
}
