import { useState } from 'react';

/**
 * ReviewCard — Flip-animation card for spaced repetition review sessions.
 * Shows question on front, answer/explanation on back.
 *
 * Props:
 *   concept: string
 *   chapter: string
 *   subject: string
 *   questionData: { question, options, correctIndex, explanation, type }
 *   onRate: (quality: 0-5) => void
 *   loading: boolean
 */
const ReviewCard = ({ concept, chapter, subject, questionData, onRate, loading }) => {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const handleAnswer = (idx) => {
    if (showResult) return;
    setSelectedAnswer(idx);
    setShowResult(true);
  };

  const isCorrect = selectedAnswer === questionData?.correctIndex;

  const handleRate = (quality) => {
    if (onRate) onRate(quality);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  if (loading) {
    return (
      <div className="card-bub-solid bg-white p-8 text-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-violet-400 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="font-black uppercase text-sm text-gray-500">Generating review question...</p>
      </div>
    );
  }

  if (!questionData) {
    return (
      <div className="card-bub-solid bg-gray-100 p-8 text-center">
        <span className="text-4xl mb-4 block">📭</span>
        <p className="font-bold text-gray-500">No question available for this concept.</p>
      </div>
    );
  }

  const isMCQ = questionData.type === 'mcq' && Array.isArray(questionData.options) && questionData.options.length > 0;
  const showRating = isMCQ ? showResult : true; // For open-ended, always show rating

  return (
    <div className="card-bub-solid bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-400 to-orange-400 border-b-4 border-black p-4">
        <p className="font-black uppercase text-xs text-gray-600">{subject} • {chapter}</p>
        <h3 className="font-black text-lg mt-1">🔄 {concept}</h3>
      </div>

      {/* Question */}
      <div className="p-6">
        <p className="font-bold text-lg mb-6 leading-relaxed">{questionData.question}</p>

        {isMCQ ? (
          <div className="space-y-3">
            {questionData.options.map((opt, i) => {
              let btnClass = 'bg-white hover:bg-gray-50';
              if (showResult) {
                if (i === questionData.correctIndex) btnClass = 'bg-green-400 text-white';
                else if (i === selectedAnswer) btnClass = 'bg-red-400 text-white';
                else btnClass = 'opacity-40';
              }

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={showResult}
                  className={`w-full text-left p-4 border border-gray-200 font-bold transition-all ${btnClass} ${!showResult ? 'hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 border border-gray-200 flex items-center justify-center font-black text-sm flex-shrink-0 ${showResult && i === questionData.correctIndex ? 'bg-white text-black' : 'bg-gradient-to-r from-blue-400 to-cyan-400'}`}>
                      {['A', 'B', 'C', 'D'][i]}
                    </span>
                    <span>{opt}</span>
                    {showResult && i === questionData.correctIndex && <span className="ml-auto">✔️</span>}
                    {showResult && i === selectedAnswer && i !== questionData.correctIndex && <span className="ml-auto">❌</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Open-ended: show a prompt to think */
          <div className="bg-amber-50 border-4 border-dashed border-gray-400 p-6 text-center">
            <span className="text-3xl block mb-2">🤔</span>
            <p className="font-bold text-gray-600">Think about your answer, then rate how well you recalled it below.</p>
          </div>
        )}
      </div>

      {/* Feedback for MCQ */}
      {showResult && isMCQ && questionData.explanation && (
        <div className="px-6 pb-2">
          <div className={`p-4 border border-gray-200 font-medium text-sm ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
            <p className="font-black uppercase text-xs mb-1">{isCorrect ? '✅ Correct!' : '❌ Incorrect'}</p>
            <p>{questionData.explanation}</p>
          </div>
        </div>
      )}

      {/* Rating — ALWAYS visible for open-ended, visible after answer for MCQ */}
      {showRating && (
        <div className="border-t-4 border-black p-6 bg-gray-50">
          <p className="font-black uppercase text-sm text-gray-700 mb-4">⬇️ Rate your recall quality:</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { q: 0, label: 'Total Blank', color: 'bg-red-400 text-white' },
              { q: 1, label: 'Barely', color: 'bg-red-300' },
              { q: 2, label: 'Struggled', color: 'bg-orange-300' },
              { q: 3, label: 'Hard', color: 'bg-yellow-300' },
              { q: 4, label: 'Good', color: 'bg-green-300' },
              { q: 5, label: 'Easy!', color: 'bg-green-400' }
            ].map(({ q, label, color }) => (
              <button
                key={q}
                onClick={() => handleRate(q)}
                className={`${color}  px-4 py-3 font-black text-sm uppercase hover:shadow-lg hover:-translate-y-1 transition-all active:translate-y-0`}
              >
                {q} — {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewCard;
