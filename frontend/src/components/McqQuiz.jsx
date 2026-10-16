import { useState } from 'react';

export default function McqQuiz({ mcqs }) {
  const [picked, setPicked] = useState({}); // questionIndex -> optionIndex
  const done = Object.keys(picked).length === mcqs.length;
  const score = mcqs.filter((q, i) => picked[i] === q.answer).length;

  if (!mcqs.length) return <p className="text-dust">No questions were generated for this lecture.</p>;
  return (
    <div className="space-y-6">
      {mcqs.map((q, qi) => {
        const chosen = picked[qi];
        const answered = chosen !== undefined;
        return (
          <fieldset key={qi} className="border border-rune bg-vault p-4">
            <legend className="px-2 text-dust">Question {qi + 1} of {mcqs.length}</legend>
            <p className="mb-3 max-w-[72ch]">{q.question}</p>
            <div className="grid gap-2">
              {q.options.map((opt, oi) => {
                let cls = 'border-rune hover:border-amber';
                if (answered && oi === q.answer) cls = 'border-good bg-good/10 text-good';
                else if (answered && oi === chosen) cls = 'border-bad bg-bad/10 text-bad';
                return (
                  <button key={oi} disabled={answered} onClick={() => setPicked({ ...picked, [qi]: oi })}
                    className={`border px-3 py-2 text-left transition-colors ${cls}`}>
                    <span className="mr-2 text-dust">{String.fromCharCode(97 + oi)})</span>{opt}
                  </button>
                );
              })}
            </div>
            {answered && (
              <p className="mt-3 text-sm text-dust" role="status">
                {chosen === q.answer ? 'Correct. ' : `Not quite, the answer is ${String.fromCharCode(97 + q.answer)}). `}
                {q.explanation}
              </p>
            )}
          </fieldset>
        );
      })}
      {done && (
        <div className="flex items-center justify-between border border-amber p-4">
          <p>You got <span className="text-amber">{score}</span> of {mcqs.length} right.</p>
          <button className="btn" onClick={() => setPicked({})}>Try again</button>
        </div>
      )}
    </div>
  );
}
