import { useState, useEffect } from 'react';

export default function Flashcards({ cards }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (!cards?.length) return <p className="text-dust">No flashcards were generated for this lecture.</p>;
  const go = (d) => { setFlipped(false); setI((i + d + cards.length) % cards.length); };
  const c = cards[i];

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, cards.length]);
  return (
    <div>
      <button className="flip block h-64 w-full text-left" onClick={() => setFlipped(!flipped)} aria-label="Flip card">
        <div className={`flip-inner relative h-full w-full ${flipped ? 'is-flipped' : ''}`}>
          <div className="flip-face absolute inset-0 flex flex-col justify-between border border-sigil bg-vault p-6">
            <span className="text-dust">Term</span>
            <span className="font-display text-4xl">{c.term}</span>
            <span className="text-dust">Click to see the definition</span>
          </div>
          <div className="flip-face flip-back absolute inset-0 flex flex-col justify-between overflow-auto border border-amber bg-vault p-6">
            <span className="text-dust">Definition</span>
            <span className="max-w-[60ch]">{c.definition}</span>
            <span className="text-dust">Click to flip back</span>
          </div>
        </div>
      </button>
      <div className="mt-4 flex items-center justify-between">
        <button className="btn" onClick={() => go(-1)}>Previous</button>
        <span className="text-dust">{i + 1} / {cards.length}</span>
        <button className="btn" onClick={() => go(1)}>Next</button>
      </div>
      <p className="mt-2 text-center text-xs text-dust">Tip: use ← / → to browse cards, space to flip</p>
    </div>
  );
}
