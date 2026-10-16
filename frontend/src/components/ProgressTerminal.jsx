import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';

/**
 * ProgressTerminal
 * Polls /api/videos/:videoId/progress every 3 s and shows real log messages
 * from the server. Falls back to cosmetic steps if videoId is not yet known.
 *
 * Props:
 *   videoId   – MongoDB _id of the video doc (available right after the 202 response)
 *   onDone    – called with the final video object when status === "done"
 *   onError   – called with an error message string when status === "error"
 */
export default function ProgressTerminal({ videoId, onDone, onError }) {
  const [lines, setLines] = useState(['Fetching captions from YouTube…']);
  const [done, setDone] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!videoId) return;

    const poll = async () => {
      try {
        const { data } = await api.get(`/videos/${videoId}/progress`);

        // Update lines from the server log
        if (data.log?.length) {
          setLines(data.log);
        }

        if (data.status === 'done') {
          setDone(true);
          clearInterval(intervalRef.current);
          // Fetch the full video doc and hand it up to the parent
          const { data: vd } = await api.get(`/videos/${videoId}`);
          onDone?.(vd.video);
        } else if (data.status === 'error') {
          clearInterval(intervalRef.current);
          onError?.(data.error || 'Analysis failed. Check the server log.');
        }
      } catch {
        // Network hiccup – keep polling
      }
    };

    intervalRef.current = setInterval(poll, 3000);
    poll(); // immediate first poll
    return () => clearInterval(intervalRef.current);
  }, [videoId, onDone, onError]);

  return (
    <div className="border border-rune bg-vault p-4 text-sm font-mono" role="status" aria-live="polite">
      {lines.map((line, i) => (
        <p
          key={i}
          className={i === lines.length - 1 && !done ? 'caret text-amber' : 'text-dust'}
        >
          {i === lines.length - 1 && !done ? '> ' : '✓ '}
          {line}
        </p>
      ))}
      {done && <p className="text-good mt-1">✓ Analysis complete — loading results…</p>}
    </div>
  );
}
