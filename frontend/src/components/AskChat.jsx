import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import api, { errMsg } from '../lib/api';

const SUGGEST = ['Explain the main idea in simple words', 'What examples did the speaker give?', 'Which terms should I remember for an exam?'];

export default function AskChat({ videoId }) {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, busy]);

  async function send(text) {
    const question = (text || q || '').trim();
    if (!question) {
      // If user clicks Ask on empty input, trigger the first suggested question
      send(SUGGEST[0]);
      return;
    }
    if (busy) return;
    const history = msgs;
    setMsgs((m) => [...m, { role: 'user', content: question }]);
    setQ('');
    setBusy(true);
    try {
      const { data } = await api.post(`/videos/${videoId}/ask`, { question, history });
      setMsgs((m) => [...m, { role: 'assistant', content: data.answer }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: `Could not answer: ${errMsg(e)}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between text-xs text-dust">
        <p>Answers come strictly from this video's lecture transcript.</p>
        {msgs.length > 0 && (
          <button type="button" onClick={() => setMsgs([])} className="hover:text-amber underline">Clear chat</button>
        )}
      </div>
      <div className="mb-3 max-h-[26rem] min-h-[12rem] space-y-3 overflow-auto border border-rune bg-ink p-3">
        {!msgs.length && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-dust">Suggested questions (click to ask):</span>
            <div className="flex flex-wrap gap-2">
              {SUGGEST.map((s) => (
                <button type="button" key={s} className="btn !py-1 text-xs text-left" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-amber' : ''}>
            <span className="mr-2 text-dust">{m.role === 'user' ? 'you>' : 'ai>'}</span>
            {m.role === 'user' ? (
              <span>{m.content}</span>
            ) : (
              <div className="prose-notes inline-block align-top">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
        {busy && <p className="caret text-dust">searching transcript & generating answer...</p>}
        <div ref={end} />
      </div>
      <div className="flex gap-2">
        <input
          className="field"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask anything about this lecture... (or click a suggestion above)"
          aria-label="Ask a question about this lecture"
        />
        <button type="button" className="btn btn-primary" onClick={() => send()} disabled={busy}>
          {busy ? 'Searching…' : 'Ask'}
        </button>
      </div>
    </div>
  );
}
