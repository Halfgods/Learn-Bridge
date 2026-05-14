import { useState, useEffect, useCallback } from 'react';
import { getUser, authFetch } from '../utils/auth';
import ReviewCard from '../components/ReviewCard';
import { backendUrl } from '../config/api';


const SpacedRepetitionPage = () => {
  const user = getUser();
  const [dueData, setDueData] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeReview, setActiveReview] = useState(null);
  const [questionData, setQuestionData] = useState(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [tab, setTab] = useState('due');
  const [initializing, setInitializing] = useState(false);

  // Load due items and stats
  const loadData = useCallback(async () => {
    try {
      const [dueRes, statsRes] = await Promise.all([
        authFetch(backendUrl('/api/spaced-repetition/due')),
        authFetch(backendUrl('/api/spaced-repetition/stats'))
      ]);
      const due = dueRes.ok ? await dueRes.json() : { items: [], totalDue: 0, bySubject: {} };
      const s = statsRes.ok ? await statsRes.json() : { streak: 0, subjectStats: {}, totalConcepts: 0 };
      setDueData(due);
      setStats(s);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadData]);

  // Initialize SR concepts from the user's curriculum
  const initializeAllConcepts = async () => {
    setInitializing(true);
    try {
      // Fetch curriculum for this user's std/board
      const currRes = await authFetch(backendUrl(`/api/curriculum?std=${user?.std}&board=${user?.board}`));
      const curriculum = await currRes.json();

      // Init SR for every subject/chapter combo
      for (const subject of curriculum) {
        for (const chapter of (subject.chapters || [])) {
          await authFetch(backendUrl('/api/spaced-repetition/init'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subjectName: subject.subjectName,
              chapterName: chapter.chapterName
            })
          });
        }
      }

      // Reload data
      await loadData();
    } catch (err) {
      console.error('Init error:', err);
    }
    setInitializing(false);
  };

  // Start a review session for a concept
  const startReview = async (item) => {
    setActiveReview(item);
    setQuestionData(null);
    setLoadingQuestion(true);

    try {
      const res = await authFetch(backendUrl('/api/spaced-repetition/generate-question'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: item.concept,
          subjectName: item.subjectName,
          chapterName: item.chapterName
        })
      });
      const data = await res.json();
      setQuestionData(data);
    } catch (err) {
      console.error('Question gen error:', err);
      setQuestionData({ question: `Explain "${item.concept}" in your own words.`, type: 'open-ended' });
    }
    setLoadingQuestion(false);
  };

  // Rate a review
  const handleRate = async (quality) => {
    if (!activeReview) return;

    try {
      await authFetch(backendUrl('/api/spaced-repetition/review'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conceptId: activeReview._id, quality })
      });

      // Refresh data
      const [due, s] = await Promise.all([
        authFetch(backendUrl('/api/spaced-repetition/due')).then(r => r.json()),
        authFetch(backendUrl('/api/spaced-repetition/stats')).then(r => r.json())
      ]);
      setDueData(due);
      setStats(s);
      setActiveReview(null);
      setQuestionData(null);
      // Award XP for completing a review
      try {
        await authFetch(backendUrl('/api/gamification/check'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'review_complete', metadata: { quality } })
        });
      } catch {}
    } catch (err) {
      console.error('Review save error:', err);
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight mb-2">🧠 Daily Practice</h1>
          <p className="font-bold text-gray-500 text-xs md:text-sm">Boost your memory — each review earns you <span className="text-amber-600">+10 XP</span>!</p>
        </div>

        {/* Streak Badge */}
        {stats && (
          <div className="card-bub-solid bg-gradient-to-r from-amber-400 to-orange-400 p-4 text-center transform rotate-2">
            <span className="text-3xl block mb-1">🔥</span>
            <p className="font-black text-2xl">{stats.streak}</p>
            <p className="font-black uppercase text-xs">Day Streak</p>
          </div>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-8 border-b-4 border-black pb-4">
        <button
          onClick={() => setTab('due')}
          className={` font-black uppercase px-6 py-3 transition-all ${tab === 'due' ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg -translate-y-0.5' : 'bg-white'}`}
        >
          📋 Due Reviews ({dueData?.totalDue || 0})
        </button>
        <button
          onClick={() => setTab('stats')}
          className={` font-black uppercase px-6 py-3 transition-all ${tab === 'stats' ? 'bg-gradient-to-r from-blue-400 to-cyan-400 shadow-lg -translate-y-0.5' : 'bg-white'}`}
        >
          📊 Mastery Stats
        </button>
      </div>

      {/* Active Review Session */}
      {activeReview && (
        <div className="mb-8 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black uppercase">Active Review</h2>
            <button
              onClick={() => { setActiveReview(null); setQuestionData(null); }}
              className="border border-gray-200 px-3 py-1 font-bold text-sm hover:bg-gray-100"
            >
              ✕ Close
            </button>
          </div>
          <ReviewCard
            concept={activeReview.concept}
            chapter={activeReview.chapterName}
            subject={activeReview.subjectName}
            questionData={questionData}
            onRate={handleRate}
            loading={loadingQuestion}
          />
        </div>
      )}

      {/* Due Reviews Tab */}
      {tab === 'due' && !activeReview && (
        <div>
          {dueData?.totalDue > 0 ? (
            <div>
              <div className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl p-6 mb-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-4xl mr-3">🧠</span>
                    <span className="font-black text-xl">You have {dueData.totalDue} concept{dueData.totalDue > 1 ? 's' : ''} to review!</span>
                    <p className="text-amber-100 text-sm mt-1">Each review earns +10 XP 🔥</p>
                  </div>
                  <button onClick={() => { const all = Object.values(dueData.bySubject || {}).flat(); if (all.length > 0) startReview(all[0]); }}
                    className="bg-white text-amber-700 font-bold px-6 py-3 rounded-full hover:shadow-xl transition-all active:scale-95">
                    ▶ Start Session
                  </button>
                </div>
              </div>

              {Object.entries(dueData.bySubject || {}).map(([subject, items]) => (
                <div key={subject} className="mb-6">
                  <h3 className="font-bold text-lg mb-3 text-gray-700">{subject}</h3>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const urgencyColor = item.interval <= 1 ? 'border-l-red-400 bg-red-50' : item.interval <= 3 ? 'border-l-amber-400 bg-amber-50' : 'border-l-green-400 bg-green-50';
                      return (
                        <div key={item._id} className={`rounded-xl border border-gray-200 border-l-4 ${urgencyColor} p-4 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer`} onClick={() => startReview(item)}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-bold text-base">{item.concept}</h4>
                              <p className="text-xs text-gray-500 mt-0.5">{item.chapterName}</p>
                            </div>
                            <button className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white px-4 py-2 rounded-full text-xs font-bold hover:shadow-lg transition-all">
                              Review →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-bub-solid bg-green-100 p-12 text-center max-w-lg mx-auto">
              <span className="text-6xl block mb-4">{stats?.totalConcepts > 0 ? '🎉' : '🚀'}</span>
              <h3 className="font-black text-2xl uppercase mb-2">
                {stats?.totalConcepts > 0 ? 'All Caught Up!' : 'Get Started'}
              </h3>
              <p className="font-bold text-gray-600 mb-6">
                {stats?.totalConcepts > 0
                  ? 'No concepts due for review right now. Great job staying on top of your studies!'
                  : 'Initialize your spaced repetition concepts from your curriculum to start reviewing!'}
              </p>
              {                (!stats || stats.totalConcepts === 0) && (
                <button
                  onClick={initializeAllConcepts}
                  disabled={initializing}
                  className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  {initializing ? '⏳ Setting up...' : '🚀 Start Daily Practice'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {tab === 'stats' && (
        <div className="space-y-6 max-w-3xl mx-auto">

          {/* Fun Summary Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card-bub-solid bg-green-400 p-5 text-center">
              <span className="text-4xl block mb-1">⭐</span>
              <p className="font-black text-3xl">{Object.values(stats?.subjectStats || {}).reduce((s, v) => s + v.mastered, 0)}</p>
              <p className="font-black uppercase text-xs mt-1">Mastered</p>
            </div>
            <div className="card-bub-solid bg-gradient-to-r from-amber-400 to-orange-400 p-5 text-center">
              <span className="text-4xl block mb-1">📖</span>
              <p className="font-black text-3xl">{Object.values(stats?.subjectStats || {}).reduce((s, v) => s + v.learning, 0)}</p>
              <p className="font-black uppercase text-xs mt-1">Learning</p>
            </div>
            <div className="card-bub-solid bg-gradient-to-r from-blue-400 to-cyan-400 p-5 text-center">
              <span className="text-4xl block mb-1">🆕</span>
              <p className="font-black text-3xl">{Object.values(stats?.subjectStats || {}).reduce((s, v) => s + v.new, 0)}</p>
              <p className="font-black uppercase text-xs mt-1">Not Started</p>
            </div>
          </div>

          {/* Per-Subject Progress Bars */}
          {stats?.subjectStats && Object.entries(stats.subjectStats).map(([subject, s]) => {
            const masteredPct = s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 0;
            const learningPct = s.total > 0 ? Math.round((s.learning / s.total) * 100) : 0;
            const emoji = subject === 'Mathematics' ? '🔢' : subject === 'Science' ? '🔬' : subject === 'English' ? '📝' : subject === 'Hindi' ? '🇮🇳' : subject === 'Social Science' ? '🌍' : '📚';

            return (
              <div key={subject} className="card-bub-solid bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-lg uppercase flex items-center gap-2">
                    <span className="text-2xl">{emoji}</span> {subject}
                  </h3>
                  <span className="font-black text-sm bg-amber-50 border border-gray-200 px-3 py-1">
                    {s.mastered + s.learning} / {s.total} started
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-8 bg-gray-200  overflow-hidden flex">
                  {masteredPct > 0 && (
                    <div
                      className="h-full bg-green-400 flex items-center justify-center font-black text-xs text-white transition-all duration-500"
                      style={{ width: `${masteredPct}%` }}
                    >
                      {masteredPct > 8 && `${masteredPct}%`}
                    </div>
                  )}
                  {learningPct > 0 && (
                    <div
                      className="h-full bg-yellow-400 flex items-center justify-center font-black text-xs transition-all duration-500"
                      style={{ width: `${learningPct}%` }}
                    >
                      {learningPct > 8 && `${learningPct}%`}
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="flex gap-4 mt-2 text-xs font-bold text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 border border-black inline-block"></span> Mastered ({s.mastered})</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 border border-black inline-block"></span> Learning ({s.learning})</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-200 border border-black inline-block"></span> New ({s.new})</span>
                </div>
              </div>
            );
          })}

          {(!stats || stats.totalConcepts === 0) && (
            <div className="card-bub-solid bg-amber-50 p-12 text-center">
              <span className="text-6xl block mb-4">📚</span>
              <h3 className="font-black text-xl uppercase mb-2">No Data Yet</h3>
              <p className="font-bold text-gray-500">Complete quizzes to start tracking your memory retention!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpacedRepetitionPage;
