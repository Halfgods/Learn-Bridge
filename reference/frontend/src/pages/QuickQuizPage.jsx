import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authFetch, getUser } from '../utils/auth';
import { backendUrl } from '../config/api';
import confetti from 'canvas-confetti';
import { addToast } from '../components/ToastContainer';

const EMOJIS = ['😊', '🙂', '😅', '🔥'];
const QUIZ_COUNT = 5;

const QuickQuizPage = () => {
  const user = getUser();
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuiz();
  }, []);

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const loadQuiz = async () => {
    setLoading(true);
    try {
      // Fetch unlocked chapters from adaptive curriculum
      const subjects = (user?.std === 7 || user?.std === 8 || user?.std === 9 || user?.std === 10)
        ? ['Science', 'Mathematics']
        : ['Science', 'Mathematics', 'English'];

      const allQuestions = [];

      for (const subject of subjects) {
        // Get adaptive curriculum (only returns unlocked chapters)
        const adaptRes = await authFetch(backendUrl(`/api/curriculum/adaptive?subject=${encodeURIComponent(subject)}`));
        if (!adaptRes.ok) continue;
        const adaptData = await adaptRes.json();
        const unlocked = (adaptData.chapters || []).filter(c => c.status !== 'locked');

        // Pick 1-2 random unlocked chapters
        const picked = shuffle(unlocked).slice(0, 2);
        for (const chapter of picked) {
          try {
            const quizRes = await fetch(backendUrl(`/api/quiz/${encodeURIComponent(subject)}/${encodeURIComponent(chapter.chapterName)}`));
            if (!quizRes.ok) continue;
            const quizData = await quizRes.json();
            if (quizData.questions && quizData.questions.length > 0) {
              // Add questions with subject/chapter context
              quizData.questions.forEach(q => {
                allQuestions.push({
                  ...q,
                  subjectName: subject,
                  chapterName: chapter.chapterName
                });
              });
            }
          } catch {}
        }
      }

      if (allQuestions.length === 0) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      // Pick random questions
      const picked = shuffle(allQuestions).slice(0, QUIZ_COUNT);
      setQuestions(picked);
      setLoading(false);
    } catch {
      setQuestions([]);
      setLoading(false);
    }
  };

  const handleAnswer = (idx) => {
    if (showResult) return;
    setSelected(idx);
    setShowResult(true);
    if (idx === questions[current].ans) {
      setScore(s => s + 1);
      confetti({ particleCount: 20, spread: 50, origin: { y: 0.8 } });
    }
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
      setShowResult(false);
    } else {
      setFinished(true);
      const pct = (score + (selected === questions[current].ans ? 1 : 0)) / questions.length;
      confetti({ particleCount: pct >= 0.6 ? 100 : 40, spread: 130, origin: { y: 0.5 } });
      addToast(`⚡ Quick quiz done!`, 'success', 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-violet-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold text-gray-500">Preparing your challenge...</p>
        </div>
      </div>
    );
  }

  if (finished) {
    const pct = score / questions.length;
    return (
      <div className="flex items-center justify-center h-[80vh] p-6">
        <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-xl border border-gray-100">
          <span className="text-7xl block mb-4 animate-bounce">{pct >= 0.7 ? '🎉' : '💪'}</span>
          <h2 className="text-3xl font-black mb-2">Quick Challenge Done!</h2>
          <p className="text-xl font-bold mb-2">{score}/{questions.length} correct</p>
          <p className="text-gray-400 mb-6">
            {pct === 1 ? 'Perfect! You\'re crushing it! 🔥' :
             pct >= 0.7 ? 'Great job! Keep it up!' :
             pct >= 0.4 ? 'Getting there! Practice makes perfect!' :
             'Keep trying! Every attempt counts! 💪'}
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/dashboard" className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-6 py-3 rounded-full">🏠 Home</Link>
            <button onClick={() => { setCurrent(0); setScore(0); setFinished(false); setSelected(null); setShowResult(false); loadQuiz(); }}
              className="bg-gray-100 font-bold px-6 py-3 rounded-full hover:bg-gray-200">🔄 New Challenge</button>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-[80vh] p-6">
        <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-xl border border-gray-100">
          <span className="text-7xl block mb-4">📚</span>
          <h2 className="text-3xl font-black mb-2">No Questions Yet</h2>
          <p className="text-gray-500 mb-6">Complete some chapters to unlock quiz questions!</p>
          <Link to="/dashboard/topic" className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-6 py-3 rounded-full inline-block">📚 Start Learning</Link>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const emoji = EMOJIS[Math.min(current, 3)];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-black">⚡ Quick Challenge</h1>
          <p className="text-gray-500 text-sm">{q.subjectName} · {current + 1} of {questions.length}</p>
        </div>
        <span className="text-3xl">{emoji}</span>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-4">
        <p className="text-xs font-bold text-gray-400 mb-2">{q.chapterName}</p>
        <h2 className="text-base md:text-lg font-bold mb-5 leading-snug">{q.q}</h2>

        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            let style = 'bg-gray-50 hover:bg-gray-100 border border-gray-200';
            if (showResult) {
              if (i === q.ans) style = 'bg-green-100 border-green-400 border-2 text-green-800';
              else if (i === selected) style = 'bg-red-100 border-red-400 border-2 text-red-800';
              else style = 'opacity-40';
            }
            return (
              <button key={i} onClick={() => handleAnswer(i)} disabled={showResult}
                className={`w-full p-3.5 rounded-xl text-left font-medium text-sm transition-all ${style} ${!showResult ? 'hover:shadow-md active:scale-[0.99]' : ''}`}>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-xs font-bold mr-3 shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {showResult && (
        <button onClick={handleNext} className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold py-3.5 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95 text-sm">
          {current < questions.length - 1 ? 'Next →' : 'See Results 🎉'}
        </button>
      )}

      <div className="flex gap-2 mt-5 justify-center">
        {questions.map((_, i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? 'bg-violet-500 scale-125' : i < current ? 'bg-green-400' : 'bg-gray-300'}`} />
        ))}
      </div>
    </div>
  );
};

export default QuickQuizPage;
