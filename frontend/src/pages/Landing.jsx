import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import ProgressTerminal from '../components/ProgressTerminal.jsx';

const OUTPUTS = [
  ['Summary', 'A structured 500-800 word markdown recap with headings per major topic.'],
  ['Key points', '15-20 concrete, specific takeaways from the whole video.'],
  ['Quiz', '10 multiple-choice questions spread across the full lecture.'],
  ['Flashcards', '10 term-definition cards from start to finish.'],
  ['Ask the video', 'Chat with the lecture. Answers come only from its transcript.'],
];

export default function Landing() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingVideoId, setPendingVideoId] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setPendingVideoId(null);
    if (!user) return nav('/login', { state: { from: '/', url } });
    setBusy(true);
    try {
      // The server responds 201 (cached) or 202 (processing started)
      const { data } = await api.post('/summarize', { url });
      if (data.cached) {
        // Already fully processed → go straight to result
        nav(`/lecture/${data.video._id}`);
      } else {
        // Processing started in background → show real progress terminal
        setPendingVideoId(data.video._id);
      }
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  const handleDone = useCallback((video) => {
    nav(`/lecture/${video._id}`);
  }, [nav]);

  const handleError = useCallback((msg) => {
    setError(msg);
    setBusy(false);
    setPendingVideoId(null);
  }, []);

  return (
    <section className="pt-16 sm:pt-24">
      <h1 className="font-display text-5xl leading-[1.05] sm:text-7xl">
        Two hours of lecture.<br />Ten minutes of revision.
      </h1>
      <p className="mt-5 max-w-[60ch] text-dust">
        Paste a YouTube lecture link. LecturAI reads the full transcript and returns a
        structured summary, key points, quiz, flashcards, and a chatbot — all powered by Llama-3.
      </p>

      <form onSubmit={submit} className="mt-10 border border-sigil bg-vault p-4 sm:p-6">
        <label htmlFor="url" className="mb-2 block text-dust">YouTube lecture link</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-2 text-amber">$</span>
            <input
              id="url"
              className="field !pl-8"
              required
              disabled={busy}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Working…' : 'Make my notes'}
          </button>
        </div>
        {error && <p className="mt-3 text-bad" role="alert">{error}</p>}
        {busy && pendingVideoId && (
          <div className="mt-4">
            <ProgressTerminal
              videoId={pendingVideoId}
              onDone={handleDone}
              onError={handleError}
            />
          </div>
        )}
        {busy && !pendingVideoId && (
          <p className="mt-3 text-dust text-sm caret">Contacting server…</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-dust">
          <span>Try a lecture:</span>
          <button type="button" onClick={() => setUrl('https://www.youtube.com/watch?v=aircAruvnKk')} className="underline hover:text-amber">Neural Networks (3B1B)</button>
          <span>·</span>
          <button type="button" onClick={() => setUrl('https://www.youtube.com/watch?v=kqtD5dpn9C8')} className="underline hover:text-amber">DBMS Normalization</button>
        </div>
        {!user && <p className="mt-2 text-xs text-dust">You'll be asked to log in first so your notes are saved.</p>}
      </form>

      <dl className="mt-16 grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {OUTPUTS.map(([t, d]) => (
          <div key={t} className="border-l border-rune pl-4">
            <dt className="font-display text-2xl">{t}</dt>
            <dd className="text-dust">{d}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
