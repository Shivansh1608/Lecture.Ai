/**
 * ai.js  –  LecturAI map-reduce pipeline
 *
 * MAP  : split transcript into ~5000-char chunks, extract structured notes per chunk
 * MERGE: hierarchically merge chunk-notes if too large for one prompt
 * REDUCE: make SEPARATE final calls for summary, keyPoints, definitions, MCQs, flashcards
 *
 * No offline/demo fallback exists. If the key is missing or Groq fails we throw,
 * and the route returns a clear JSON error to the UI.
 */

import { chunkText } from './transcript.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Key check ────────────────────────────────────────────────────────────────

export function hasGroqKey() {
  const k = process.env.GROQ_API_KEY;
  return Boolean(k && !k.startsWith('gsk_your_key') && k.trim().length > 15);
}

function requireKey() {
  if (!hasGroqKey()) {
    throw Object.assign(
      new Error('Groq API key is missing on the server. Add GROQ_API_KEY to backend/.env and restart.'),
      { status: 500 }
    );
  }
}

// ─── Core Groq caller with 429 back-off ───────────────────────────────────────

async function groq(
  messages,
  { json = false, temperature = 0.2, max_tokens = 2048 } = {},
  attempt = 0
) {
  requireKey();
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (res.status === 429) {
    if (attempt >= 5) throw Object.assign(new Error('Groq is rate limiting. Please wait a minute and try again.'), { status: 429 });
    const wait = 10_000 * (attempt + 1);
    console.log(`[LecturAI] 429 rate-limit hit – waiting ${wait / 1000}s (attempt ${attempt + 1})`);
    await sleep(wait);
    return groq(messages, { json, temperature, max_tokens }, attempt + 1);
  }

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw Object.assign(new Error(`Groq error ${res.status}: ${body}`), { status: 502 });
  }

  return (await res.json()).choices[0].message.content;
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function safeParse(s) {
  if (!s) throw new Error('AI returned an empty response');
  // Strip Qwen3 <think>...</think> reasoning blocks before parsing
  let cleaned = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('AI returned invalid JSON');
  }
}

async function groqJson(messages, opts) {
  for (let i = 0; i < 2; i++) {
    try {
      return safeParse(await groq(messages, { json: true, ...opts }));
    } catch (e) {
      if (i === 1) throw Object.assign(e, { status: 502 });
      console.log('[LecturAI] JSON parse failed, retrying once…');
      await sleep(2000);
    }
  }
}

// ─── System prompt shared across all calls ────────────────────────────────────

const SYSTEM = `You are a university professor creating rigorous study material.
Use ONLY the lecture content provided. Do not invent topics not covered.
Ignore sponsor messages, channel intros, outros, and filler phrases.
The transcript comes from YouTube auto-captions and may contain speech-to-text errors in technical terms (e.g. "spring boot" written as "spring but", "maven" as "maven", "bean" as "bean", "annotation" as "annotation", "dependency injection" may be garbled). Fix obvious mistakes when you encounter them.
Write all output in clear, professional English.`;

// ─── MAP phase ────────────────────────────────────────────────────────────────
// For each ~5000-char chunk extract structured notes. We keep topic order.

async function mapChunk(chunk, idx, total) {
  const prompt = `This is part ${idx + 1} of ${total} of a lecture transcript.
Extract structured notes using ONLY what is in this chunk. Return JSON:
{
  "topic": "short label for what this chunk covers",
  "keyPoints": ["3-6 concrete points taught here"],
  "definitions": [{"term": "...", "meaning": "..."}],
  "examples": ["brief descriptions of examples/demos shown"],
  "codeOrCommands": ["any commands, code snippets, or tool names mentioned"]
}
Chunk:
${chunk}`;

  return groqJson(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { max_tokens: 900 }
  );
}

// ─── MERGE phase ──────────────────────────────────────────────────────────────
// If combined chunk-notes are too large, merge in groups of up to 8 notes at a time.

function notesToText(notes) {
  return notes.map((n, i) =>
    `### Part ${i + 1}: ${n?.topic || 'Untitled'}\n` +
    `Key points: ${(n?.keyPoints || []).join(' | ')}\n` +
    `Definitions: ${(n?.definitions || []).map((d) => `${d.term}: ${d.meaning}`).join('; ')}\n` +
    `Examples: ${(n?.examples || []).join('; ')}\n` +
    `Code/Commands: ${(n?.codeOrCommands || []).join(', ')}`
  ).join('\n\n');
}

async function mergeNotes(noteGroups) {
  const text = notesToText(noteGroups);
  const prompt = `Merge these ordered lecture-section notes into a single condensed outline.
Preserve the chronological order of topics. Keep all important definitions, examples and commands.
Return JSON: { "mergedNotes": "markdown outline with ## headings per topic" }

Notes to merge:
${text}`;

  const out = await groqJson(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { max_tokens: 2000 }
  );
  return out?.mergedNotes || text;
}

const GROUP_SIZE = 8;

async function buildCondensed(allNotes) {
  if (allNotes.length <= GROUP_SIZE) {
    return notesToText(allNotes);
  }
  // First level merge
  const groups = [];
  for (let i = 0; i < allNotes.length; i += GROUP_SIZE) {
    groups.push(allNotes.slice(i, i + GROUP_SIZE));
  }
  const merged = await Promise.all(groups.map(mergeNotes));
  const combined = merged.join('\n\n---\n\n');
  // If still too long, do one more merge pass
  if (combined.length > 20_000) {
    const half = Math.ceil(merged.length / 2);
    const a = await mergeNotes(merged.slice(0, half).map((m) => ({ topic: '', keyPoints: [m], definitions: [], examples: [], codeOrCommands: [] })));
    const b = await mergeNotes(merged.slice(half).map((m) => ({ topic: '', keyPoints: [m], definitions: [], examples: [], codeOrCommands: [] })));
    return `${a}\n\n---\n\n${b}`;
  }
  return combined;
}

// ─── REDUCE phase – 5 separate calls ─────────────────────────────────────────

async function reduceSummary(condensed) {
  const prompt = `Based on the following ordered lecture notes, write a structured markdown summary of 500-800 words.
Rules:
- Start with ONE sentence: what the video is about and who it is for.
- Then use ## headings for each MAJOR topic IN THE ORDER the video covers them (beginning → middle → end of the lecture).
- Under each heading, write 3-5 sentences covering the key ideas taught.
- Cover content from the START, MIDDLE, and END of the lecture.
- Do not add content not in the notes.

Lecture notes:
${condensed}`;

  return groq(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { max_tokens: 1500, temperature: 0.3 }
  );
}

async function reduceKeyPoints(condensed) {
  const prompt = `From the following ordered lecture notes, extract 15-20 specific, concrete key points.
Rules:
- Each point must be a specific fact, rule, definition, or technique actually taught.
- No generic filler like "the lecture covers many topics".
- Cover points from the start, middle, and end of the lecture.
- Write as complete sentences.
Return JSON: { "keyPoints": ["point 1", "point 2", ...] }

Lecture notes:
${condensed}`;

  const out = await groqJson(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { max_tokens: 1500 }
  );
  const kp = (out?.keyPoints || []).map(String).filter(Boolean);
  if (kp.length < 10) throw new Error(`Only got ${kp.length} key points (expected 15-20)`);
  return kp;
}

async function reduceDefinitions(condensed) {
  const prompt = `From the following lecture notes, list 8-12 real technical terms that were actually taught or defined in this lecture.
For each term write an accurate, self-contained definition (2-4 sentences).
Return JSON: { "definitions": [{"term": "...", "meaning": "..."}, ...] }

Lecture notes:
${condensed}`;

  const out = await groqJson(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { max_tokens: 1500 }
  );
  return (out?.definitions || []).filter((d) => d?.term && d?.meaning);
}

async function reduceMcqs(condensed, chunkCount) {
  // Pass the chunk count so the model knows how to spread questions
  const thirdSize = Math.ceil(chunkCount / 3);
  const prompt = `From the following ordered lecture notes, write EXACTLY 10 multiple-choice questions.
Rules:
- Spread questions evenly: ~3-4 from the FIRST third of the lecture, ~3 from the MIDDLE third, ~3-4 from the LAST third.
- Each question must test a SPECIFIC fact, concept, or technique from the lecture.
- No "all of the above" options. Wrong options must be plausible but clearly incorrect.
- No duplicate questions.
- Each question has exactly 4 options.
- "answer" is the 0-based index (0-3) of the correct option.
- "section" is one of: "beginning", "middle", "end".
Return JSON:
{
  "mcqs": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "answer": 0,
      "explanation": "one sentence why this is correct",
      "section": "beginning"
    }
  ]
}
(Provide all 10 questions in the array.)

Lecture notes (${chunkCount} chunks total, ${thirdSize} chunks per third):
${condensed}`;

  const out = await groqJson(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { max_tokens: 2500 }
  );
  const mcqs = (out?.mcqs || [])
    .filter((q) => q?.question && Array.isArray(q.options) && q.options.length === 4)
    .map((q) => ({
      question: q.question,
      options: q.options.map(String),
      answer: Math.min(3, Math.max(0, Number(q.answer) || 0)),
      explanation: String(q.explanation || ''),
      section: ['beginning', 'middle', 'end'].includes(q.section) ? q.section : 'middle',
    }));
  if (mcqs.length < 10) throw new Error(`Only got ${mcqs.length} MCQs (need exactly 10)`);
  return mcqs.slice(0, 10);
}

async function reduceFlashcards(condensed) {
  const prompt = `From the following lecture notes, create exactly 10 flashcards covering terms, concepts or techniques from across the WHOLE lecture (beginning, middle and end).
Return JSON: { "flashcards": [{"term": "...", "definition": "..."}, ...] }

Lecture notes:
${condensed}`;

  const out = await groqJson(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { max_tokens: 1200 }
  );
  return (out?.flashcards || []).filter((f) => f?.term && f?.definition).slice(0, 10);
}

// ─── Retry wrapper for individual reduce calls ─────────────────────────────────

async function withRetry(label, fn) {
  for (let i = 0; i < 2; i++) {
    try {
      return await fn();
    } catch (e) {
      console.log(`[LecturAI] ${label} failed (attempt ${i + 1}): ${e.message}`);
      if (i === 1) throw Object.assign(e, { status: 502 });
      await sleep(4000);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * generateStudyPack(transcript, onProgress)
 *
 * onProgress(msg: string) is called with human-readable status strings that the
 * route stores in Video.processingLog for polling by the UI.
 */
export async function generateStudyPack(transcript, onProgress = () => {}) {
  requireKey();

  // MAP
  const chunks = chunkText(transcript, 5000);
  const totalChunks = chunks.length;
  onProgress(`Splitting transcript into ${totalChunks} chunks`);
  console.log(`[LecturAI] MAP: ${totalChunks} chunks`);

  const chunkNotes = [];
  for (let i = 0; i < chunks.length; i++) {
    const msg = `Reading part ${i + 1} of ${totalChunks}`;
    onProgress(msg);
    console.log(`[LecturAI] ${msg}`);
    const note = await mapChunk(chunks[i], i, totalChunks);
    chunkNotes.push(note);
    // Small pause between calls to stay under free-tier token/min limit
    if (i < chunks.length - 1) await sleep(1500);
  }

  // MERGE
  onProgress('Merging chunk notes');
  console.log('[LecturAI] MERGE phase');
  const condensed = await buildCondensed(chunkNotes);
  console.log(`[LecturAI] Condensed length: ${condensed.length} chars`);

  // REDUCE (5 separate calls, sequential with small gaps)
  onProgress('Writing summary');
  const summary = await withRetry('summary', () => reduceSummary(condensed));

  await sleep(2000);
  onProgress('Extracting key points');
  const keyPoints = await withRetry('keyPoints', () => reduceKeyPoints(condensed));

  await sleep(2000);
  onProgress('Extracting definitions');
  const definitions = await withRetry('definitions', () => reduceDefinitions(condensed));

  await sleep(2000);
  onProgress('Building quiz (10 questions)');
  const mcqs = await withRetry('mcqs', () => reduceMcqs(condensed, totalChunks));

  await sleep(2000);
  onProgress('Creating flashcards');
  const flashcards = await withRetry('flashcards', () => reduceFlashcards(condensed));

  onProgress(`Done — ${keyPoints.length} key points, ${mcqs.length} MCQs, ${definitions.length} definitions`);
  console.log(`[LecturAI] DONE: ${keyPoints.length} key points | ${mcqs.length} MCQs | ${definitions.length} definitions | ${flashcards.length} flashcards`);

  return {
    summary: String(summary || ''),
    keyPoints,
    definitions,
    mcqs,
    flashcards,
    isFallback: false,
  };
}

// ─── RAG chat ─────────────────────────────────────────────────────────────────

export async function answerFromContext(question, passages, history = []) {
  requireKey();
  const context = passages.map((p, i) => `[${i + 1}] ${p}`).join('\n\n');
  return groq(
    [
      {
        role: 'system',
        content:
          'You answer questions about ONE lecture using only the excerpts given. If the excerpts do not contain the answer, say "This video doesn\'t cover that." Be concise and precise.',
      },
      ...history.slice(-6).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: String(m.content).slice(0, 1000),
      })),
      { role: 'user', content: `Excerpts:\n${context}\n\nQuestion: ${question}` },
    ],
    { max_tokens: 700 }
  );
}
