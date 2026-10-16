import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api, { errMsg } from '../lib/api';
import McqQuiz from '../components/McqQuiz.jsx';
import Flashcards from '../components/Flashcards.jsx';
import AskChat from '../components/AskChat.jsx';
import ProgressTerminal from '../components/ProgressTerminal.jsx';

const TABS = ['Summary', 'Key points', 'Quiz', 'Flashcards', 'Ask the video'];

export default function Result() {
  const { id } = useParams();
  const nav = useNavigate();
  const [v, setV] = useState(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    setV(null);
    setError('');
    api.get(`/videos/${id}`)
      .then((r) => {
        const video = r.data.video;
        setV(video);
        // If the video is still being processed (e.g. navigated here directly), show terminal
        if (video.processingStatus === 'processing') setProcessing(true);
        else if (video.processingStatus === 'error') setError(video.processingError || 'Analysis failed');
      })
      .catch((e) => setError(errMsg(e)));
  }, [id]);

  const handleDone = useCallback((video) => {
    setV(video);
    setProcessing(false);
  }, []);

  const handleError = useCallback((msg) => {
    setError(msg);
    setProcessing(false);
  }, []);

  if (error) return (
    <div className="pt-10">
      <p className="text-bad" role="alert">{error}</p>
      <button className="btn mt-4" onClick={() => nav('/')}>← Back</button>
    </div>
  );

  if (!v) return <p className="pt-10 text-dust caret">loading lecture</p>;

  // Still being analyzed — show the progress terminal
  if (processing || v.processingStatus === 'processing') {
    return (
      <section className="pt-8 max-w-2xl">
        <h1 className="font-display text-2xl mb-4">{v.title || 'Analyzing lecture…'}</h1>
        <ProgressTerminal videoId={id} onDone={handleDone} onError={handleError} />
      </section>
    );
  }

  return (
    <section className="grid gap-6 pt-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Left column: video embed + controls */}
      <div className="no-print lg:sticky lg:top-4 lg:self-start">
        <div className="aspect-video border border-rune">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${v.videoId}`}
            title={v.title}
            allowFullScreen
          />
        </div>
        <h1 className="mt-3 font-display text-2xl leading-tight">{v.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn !py-1 text-xs" onClick={() => window.print()}>Export PDF</button>
        </div>
        {/* Stats strip */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-dust">
          {v.keyPoints?.length > 0 && <span>{v.keyPoints.length} key points</span>}
          {v.mcqs?.length > 0 && <span>{v.mcqs.length} quiz questions</span>}
          {v.definitions?.length > 0 && <span>{v.definitions.length} definitions</span>}
          {v.flashcards?.length > 0 && <span>{v.flashcards.length} flashcards</span>}
        </div>
      </div>

      {/* Right column: tabbed content */}
      <div className="print-area min-w-0">
        {/* Print header */}
        <div className="hidden print:block mb-6 border-b border-gray-400 pb-3">
          <h1 className="font-display text-3xl font-bold text-black">{v.title}</h1>
          <p className="text-xs text-gray-600 mt-1">Lecture Study Notes · LecturAI</p>
        </div>

        {/* Tab bar */}
        <div role="tablist" className="no-print mb-4 flex flex-wrap gap-1 border-b border-rune">
          {TABS.map((t, i) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className={`px-3 py-2 ${tab === i ? 'border-b-2 border-amber text-amber' : 'text-dust hover:text-parchment'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Summary tab — markdown rendered, definitions below */}
        <div className={tab === 0 ? '' : 'hidden print:block'}>
          <div className="prose-notes">
            <ReactMarkdown>{v.summary}</ReactMarkdown>
          </div>
          {!!v.definitions?.length && (
            <dl className="mt-6 space-y-3">
              <h2 className="font-display text-xl mb-3">Definitions</h2>
              {v.definitions.map((d, i) => (
                <div key={i} className="border-l border-sigil pl-3">
                  <dt className="text-amber">{d.term}</dt>
                  <dd className="max-w-[72ch] text-dust">{d.meaning}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Key points tab */}
        <div className={tab === 1 ? '' : 'hidden print:block'}>
          <h2 className="mb-2 mt-6 font-display text-2xl print:block hidden">Key points</h2>
          <ul className="list-disc space-y-2 pl-5">
            {v.keyPoints.map((k, i) => <li key={i} className="max-w-[72ch]">{k}</li>)}
          </ul>
        </div>

        {/* Quiz tab */}
        {tab === 2 && <McqQuiz key={v._id} mcqs={v.mcqs} />}

        {/* Flashcards tab */}
        {tab === 3 && <Flashcards key={v._id} cards={v.flashcards} />}

        {/* Ask tab */}
        {tab === 4 && <AskChat videoId={v._id} />}
      </div>
    </section>
  );
}
