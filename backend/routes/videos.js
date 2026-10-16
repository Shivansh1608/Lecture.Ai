import { Router } from 'express';
import Video from '../models/Video.js';
import { requireAuth } from '../middleware/auth.js';
import { extractVideoId, getVideoMeta, getTranscript, chunkText } from '../services/transcript.js';
import { generateStudyPack, answerFromContext, hasGroqKey } from '../services/ai.js';
import { topPassages } from '../services/rag.js';

const router = Router();
router.use(requireAuth);

// ─── POST /api/summarize  { url, force } ──────────────────────────────────────
// Kicks off analysis in the background. Returns the (stub) video doc immediately
// so the UI can start polling /api/videos/:id/progress.
router.post('/summarize', async (req, res, next) => {
  try {
    const { url, force = false } = req.body;
    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ message: 'That does not look like a YouTube link' });

    // Key check — fail fast before touching the DB
    if (!hasGroqKey()) {
      return res.status(500).json({
        message: 'Groq API key is missing on the server. Add GROQ_API_KEY to backend/.env and restart.',
      });
    }

    const cached = await Video.findOne({ userId: req.userId, videoId });
    if (cached && !force && cached.processingStatus === 'done') {
      // Return the fully finished doc from cache
      const { transcript: _t, ...safe } = cached.toObject();
      return res.json({ video: safe, cached: true });
    }

    // Fetch meta and transcript synchronously (fast) so we can respond quickly
    const [meta, transcript] = await Promise.all([
      getVideoMeta(videoId),
      getTranscript(videoId),
    ]);

    // Upsert the stub doc with status = processing
    let video;
    if (cached) {
      cached.processingStatus = 'processing';
      cached.processingLog = [];
      cached.processingError = '';
      Object.assign(cached, meta);
      cached.transcript = transcript;
      await cached.save();
      video = cached;
    } else {
      video = await Video.create({
        userId: req.userId,
        videoId,
        youtubeUrl: url,
        language: 'English',
        transcript,
        ...meta,
        processingStatus: 'processing',
        processingLog: [],
        processingError: '',
      });
    }

    const videoDocId = video._id.toString();

    // Respond immediately with the stub so the UI can start polling
    const { transcript: _t, ...safe } = video.toObject();
    res.status(202).json({ video: safe, cached: false });

    // Run the AI pipeline in the background (fire-and-forget)
    ;(async () => {
      try {
        const onProgress = async (msg) => {
          await Video.findByIdAndUpdate(videoDocId, {
            $push: { processingLog: msg },
          });
        };

        const pack = await generateStudyPack(transcript, onProgress);

        await Video.findByIdAndUpdate(videoDocId, {
          ...pack,
          processingStatus: 'done',
          processingError: '',
        });

        console.log(`[LecturAI] Analysis complete for ${videoId}`);
      } catch (err) {
        console.error(`[LecturAI] Analysis failed for ${videoId}:`, err.message);
        await Video.findByIdAndUpdate(videoDocId, {
          processingStatus: 'error',
          processingError: err.message || 'Analysis failed',
        });
      }
    })();
  } catch (e) { next(e); }
});

// ─── GET /api/videos/:id/progress  – polling endpoint ─────────────────────────
// Returns { status, log, error } so the UI can drive a real progress terminal.
router.get('/videos/:id/progress', async (req, res, next) => {
  try {
    const video = await Video.findOne(
      { _id: req.params.id, userId: req.userId },
      'processingStatus processingLog processingError'
    );
    if (!video) return res.status(404).json({ message: 'Lecture not found' });
    res.json({
      status: video.processingStatus,
      log: video.processingLog,
      error: video.processingError,
    });
  } catch (e) { next(e); }
});

// ─── GET /api/videos  ?q=… ───────────────────────────────────────────────────
router.get('/videos', async (req, res, next) => {
  try {
    const filter = { userId: req.userId };
    const q = (req.query.q || '').trim();
    if (q) filter.$or = [
      { title: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { keyPoints: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { summary: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    ];
    const videos = await Video.find(filter)
      .sort({ createdAt: -1 })
      .select('title thumbnail videoId language createdAt summary processingStatus');
    res.json({ videos });
  } catch (e) { next(e); }
});

// ─── GET /api/videos/:id ──────────────────────────────────────────────────────
router.get('/videos/:id', async (req, res, next) => {
  try {
    const video = await Video.findOne({ _id: req.params.id, userId: req.userId });
    if (!video) return res.status(404).json({ message: 'Lecture not found' });
    res.json({ video });
  } catch (e) { next(e); }
});

// ─── DELETE /api/videos/:id ───────────────────────────────────────────────────
router.delete('/videos/:id', async (req, res, next) => {
  try {
    await Video.deleteOne({ _id: req.params.id, userId: req.userId });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── POST /api/videos/:id/ask  { question, history } ─────────────────────────
router.post('/videos/:id/ask', async (req, res, next) => {
  try {
    const { question, history } = req.body;
    if (!question?.trim()) return res.status(400).json({ message: 'Ask a question' });
    const video = await Video.findOne({ _id: req.params.id, userId: req.userId }).select('+transcript');
    if (!video) return res.status(404).json({ message: 'Lecture not found' });

    let passages = topPassages(video.transcript, question);
    if (!passages.length) {
      if (video.summary || video.keyPoints?.length) {
        passages = [video.summary, (video.keyPoints || []).join('\n\n')].filter(Boolean);
      } else if (video.transcript) {
        passages = chunkText(video.transcript, 1200).slice(0, 2);
      }
    }
    if (!passages.length) return res.json({ answer: "This video doesn't cover that." });
    res.json({ answer: await answerFromContext(question, passages, history) });
  } catch (e) { next(e); }
});

export default router;
