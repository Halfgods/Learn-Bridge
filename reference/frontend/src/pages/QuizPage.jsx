import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { authFetch } from '../utils/auth';
import { backendUrl } from '../config/api';
import confetti from 'canvas-confetti';
import LevelUpCelebration from '../components/LevelUpCelebration';
import { addToast } from '../components/ToastContainer';

const QuizPage = () => {
  const { subject, chapter } = useParams();

  const [quizBank, setQuizBank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  // Timer & Feedback States
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [perfUpdate, setPerfUpdate] = useState(null);
  const [levelUpData, setLevelUpData] = useState(null);
  const hasSavedRef = useRef(false);

  // ── Fetch Quiz Data from DB ──────────────────────────────────
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await fetch(backendUrl(`/api/quiz/${encodeURIComponent(subject)}/${encodeURIComponent(chapter)}`));
        const data = await res.json();
        if (data.questions) {
          setQuizBank(data.questions);
        }
      } catch (err) {
        console.error('Error fetching quiz:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [subject, chapter]);

  const handleNext = useCallback(() => {
    if (currentQuestion < quizBank.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setTimeLeft(30);
      setSelectedIdx(null);
      setShowFeedback(false);
      setIsLocked(false);
    } else {
      setFinished(true);
    }
  }, [currentQuestion, quizBank.length]);

  // Timer Effect
  useEffect(() => {
    if (finished || isLocked || loading || quizBank.length === 0) return;

    const timer = setTimeout(() => {
      if (timeLeft <= 0) {
        handleNext();
        return;
      }
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, finished, isLocked, handleNext, loading, quizBank.length]);

  // Persistence Effect
  useEffect(() => {
    if (finished && quizBank.length > 0 && !hasSavedRef.current) {
      hasSavedRef.current = true;
      const pct = score / quizBank.length;
      const cCount = pct >= 0.9 ? 80 : pct >= 0.5 ? 60 : 30;
      confetti({ particleCount: cCount, spread: 100, origin: { y: 0.6 } });
      if (pct >= 0.9) {
        setTimeout(() => confetti({ particleCount: 50, spread: 140, origin: { y: 0.5, x: 0.3 } }), 300);
        setTimeout(() => confetti({ particleCount: 50, spread: 140, origin: { y: 0.5, x: 0.7 } }), 500);
      }
      const saveResult = async () => {
        try {
          const res = await authFetch(backendUrl('/api/progress'), {
            method: 'POST',
            body: JSON.stringify({
              subjectName: subject,
              chapterName: chapter,
              quizScore: score,
              totalQuestions: quizBank.length,
              isCompleted: true
            })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (data.performance) {
            setPerfUpdate(data.performance);
            if (data.performance.leveledUp) {
              setLevelUpData({
                starName: data.performance.starName,
                starLevel: data.performance.starLevel,
                subject
              });
            }
          }

          // Auto-initialize spaced repetition for this chapter
          try {
            await authFetch(backendUrl('/api/spaced-repetition/init'), {
              method: 'POST',
              body: JSON.stringify({
                subjectName: subject,
                chapterName: chapter
              })
            });
            console.log('Spaced repetition concepts initialized');
          } catch (srErr) {
            console.warn('SR init skipped:', srErr);
          }

          try {
            const gcRes = await authFetch(backendUrl('/api/gamification/check'), {
              method: 'POST',
              body: JSON.stringify({ action: 'quiz_complete', metadata: { score: pct } })
            });
            if (gcRes.ok) {
              const gcData = await gcRes.json();
              if (gcData.newAchievements?.length) {
                gcData.newAchievements.forEach(a => {
                  addToast(`🏆 ${a.name} — ${a.desc}`, 'achievement', 4000);
                });
              }
            }
          } catch (gcErr) {
            console.warn('Gamification check skipped:', gcErr);
          }
        } catch (err) {
          console.error('Failed to save progress:', err);
        }
      };
      saveResult();
    }
  }, [finished, score, subject, chapter, quizBank.length]);

  const handleAnswer = (idx) => {
    if (isLocked) return;

    setSelectedIdx(idx);
    setIsLocked(true);
    setShowFeedback(true);

    if (idx === quizBank[currentQuestion].ans) {
      setScore(s => s + 1);
    }

    // Short delay for feedback before moving on
    setTimeout(() => {
      handleNext();
    }, 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-violet-400 rounded-full animate-spin mb-4 mx-auto"></div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Preparing your quiz challenge! 🧠</h2>
        </div>
      </div>
    );
  }

  if (finished) {
    const pct = score / quizBank.length;
    const emoji = pct >= 0.9 ? '🌟' : pct >= 0.7 ? '🎉' : pct >= 0.5 ? '👍' : '💪';
    const message = pct === 1 ? 'PERFECT SCORE! You\'re a Genius!' :
      pct >= 0.9 ? 'Amazing! Almost Perfect!' :
      pct >= 0.7 ? 'Great Job! Keep it up!' :
      pct >= 0.5 ? 'Good Try! Practice makes perfect!' :
      'Don\'t give up! Try again and you\'ll improve!';
    const colorClass = pct >= 0.7 ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-pink-500 to-rose-500';

    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)] p-8">
        <div className="card-bub-solid max-w-lg w-full p-10 text-center relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-2 ${colorClass}`}></div>
          <span className="text-8xl block mb-4 pt-6 animate-bounce">{emoji}</span>
          <h1 className="text-4xl font-black uppercase mb-2 tracking-tighter">Quiz Complete!</h1>
          <p className="font-bold text-lg text-gray-600 mb-6">{message}</p>
          <div className="card-bub-solid bg-gray-50 p-6 mb-4 inline-block mx-auto">
            <span className="text-5xl font-black">{score}</span>
            <span className="text-2xl font-black text-gray-400">/{quizBank.length}</span>
          </div>

          {perfUpdate && (
            <div className={`mb-6 p-4 rounded-2xl font-bold text-sm ${perfUpdate.leveledUp ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white animate-bounce' : 'bg-gray-100'}`}>
              {perfUpdate.leveledUp ? (
                <span>🎉 Level Up! You're now <strong>{perfUpdate.starName}</strong> (⭐ {perfUpdate.starLevel}/5) in {subject}!</span>
              ) : (
                <span>{perfUpdate.starName} ⭐ {perfUpdate.starLevel}/5 · Avg: {perfUpdate.averageScore}%</span>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-center flex-wrap">
            <Link to={`/dashboard/topic`} className="bg-gray-100 font-bold px-5 py-3 rounded-full hover:bg-gray-200 transition-all text-sm">📚 Back to Topics</Link>
            <Link to={`/dashboard/learn/${encodeURIComponent(subject)}/${encodeURIComponent(chapter)}`} className="bg-gradient-to-r from-blue-400 to-cyan-400 text-white font-bold px-5 py-3 rounded-full hover:shadow-lg transition-all text-sm">🤖 Learn</Link>
            <button onClick={() => { setCurrentQuestion(0); setScore(0); setFinished(false); setTimeLeft(30); setSelectedIdx(null); setShowFeedback(false); setIsLocked(false); setPerfUpdate(null); hasSavedRef.current = false; }} className="bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold px-5 py-3 rounded-full hover:shadow-lg transition-all text-sm">🔄 Retake Quiz</button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = quizBank[currentQuestion];

  if (!currentQ) {
    return (
      <div className="p-8 text-center mt-20">
        <h2 className="text-2xl font-black uppercase">Hmm, no questions for this topic yet! Try another chapter 📚</h2>
        <Link to="/dashboard/topic" className="btn-bub-primary mt-4 inline-block">Go Back</Link>
      </div>
    );
  }

  const timerEmoji = timeLeft > 20 ? '😊' : timeLeft > 10 ? '😅' : '🔥';

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto mt-4 md:mt-12 pb-24 lg:pb-20">
      <div className="flex justify-between items-end mb-6 md:mb-8 border-b-4 border-black pb-4 gap-3">
        <div>
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter leading-tight">{chapter} Quiz</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-bold text-gray-500 uppercase text-xs">{subject}</span>
            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
            <span className="font-bold text-pink-500 text-xs uppercase">Q{currentQuestion + 1} of {quizBank.length}</span>
          </div>
        </div>
        {/* Child-friendly Timer */}
        <div className={`min-w-[60px] min-h-[60px] md:min-w-[72px] md:min-h-[72px] flex flex-col items-center justify-center font-black shadow-lg transition-all ${timeLeft <= 10 ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white scale-110' : timeLeft <= 20 ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-blue-400 to-cyan-400'}`}>
          <span className="text-xl md:text-2xl">{timeLeft}</span>
          <span className="text-[8px] md:text-[10px] uppercase leading-tight">{timeLeft === 1 ? 'sec' : 'secs'}</span>
          <span className="text-sm md:text-base">{timerEmoji}</span>
        </div>
      </div>

      <div className="card-bub-solid p-4 md:p-10 relative">
        <span className="absolute -top-5 md:-top-6 -left-5 md:-left-6 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black flex items-center justify-center shadow-lg">
          ?
        </span>
        <h2 className="text-lg md:text-2xl font-bold mb-6 md:mb-10 leading-snug pt-2 md:pt-0">{currentQ.q}</h2>

        <div className="space-y-3 md:space-y-4">
          {currentQ.options.map((opt, i) => {
            let statusClass = "bg-white";
            if (showFeedback) {
              if (i === currentQ.ans) statusClass = "bg-green-400 text-white border-green-600";
              else if (i === selectedIdx) statusClass = "bg-red-400 text-white border-red-600";
              else statusClass = "opacity-50 transition-opacity duration-300";
            }

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={isLocked}
                className={`card-bub-solid w-full text-left p-4 md:p-6 font-bold text-base md:text-lg transition-all min-h-[56px] ${statusClass} ${!isLocked && 'active:scale-[0.98] md:hover:bg-gray-100 md:hover:-translate-y-1 md:hover:shadow-lg'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 md:gap-4">
                    <span className={`inline-block border-2 border-gray-200 w-8 h-8 md:w-10 md:h-10 text-center leading-7 md:leading-9 font-black text-sm md:text-base shrink-0 ${showFeedback && i === currentQ.ans ? 'bg-white text-black' : 'bg-gradient-to-r from-blue-400 to-cyan-400'}`}>
                      {['A', 'B', 'C', 'D'][i]}
                    </span>
                    <span className="text-sm md:text-lg">{opt}</span>
                  </div>
                  {showFeedback && i === currentQ.ans && <span className="text-xl md:text-2xl">✔️</span>}
                  {showFeedback && i === selectedIdx && i !== currentQ.ans && <span className="text-xl md:text-2xl">❌</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="mt-6 md:mt-8 flex gap-1.5 md:gap-2">
        {quizBank.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 md:h-3 border border-gray-200 ${i < currentQuestion ? 'bg-gradient-to-r from-pink-500 to-rose-500' : i === currentQuestion ? 'bg-gradient-to-r from-amber-400 to-orange-400 animate-pulse' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      <LevelUpCelebration
        show={!!levelUpData}
        starName={levelUpData?.starName || ''}
        starLevel={levelUpData?.starLevel || 1}
        subject={levelUpData?.subject || ''}
        onClose={() => setLevelUpData(null)}
      />
    </div>
  );
};

export default QuizPage;
