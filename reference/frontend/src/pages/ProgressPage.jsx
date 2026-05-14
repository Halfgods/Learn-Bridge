import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { getUser, authFetch } from '../utils/auth';
import { backendUrl } from '../config/api';

const BAR_COLORS = ['#FF66A1', '#A2D2FF', '#FFD500', '#1a1a1a'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className=" bg-white p-3  font-black">
        <p className="uppercase text-sm text-gray-500">{label}</p>
        <p className="text-3xl">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

const ProgressPage = () => {
  const [progress, setProgress] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [insight, setInsight] = useState('Analyzing your recent performance...');
  const user = getUser(); // decoded from JWT — no raw localStorage fields
  const fullName = user?.fullName || 'Scholar';
  const std = user?.std || 10;
  const board = user?.board || 'CBSE';

  useEffect(() => {
    Promise.all([
      authFetch(backendUrl('/api/progress')).then(r => r.ok ? r.json() : []),
      fetch(backendUrl(`/api/curriculum?std=${std}&board=${board}`)).then(r => r.ok ? r.json() : [])
    ])
      .then(([progressData, curriculumData]) => {
        const safeProgress = Array.isArray(progressData) ? progressData : [];
        const safeCurriculum = Array.isArray(curriculumData) ? curriculumData : [];
        setProgress(safeProgress);
        setCurriculum(safeCurriculum);
        const validScores = safeProgress.filter(p => p.totalQuestions > 0);
        if (validScores.length > 0) {
          const best = validScores.reduce((a, b) =>
            (a.quizScore / a.totalQuestions) > (b.quizScore / b.totalQuestions) ? a : b
          );
          const pct = Math.round((best.quizScore / best.totalQuestions) * 100);
          setInsight(`Great work, ${fullName}! Your best score is in "${best.chapterName}" (${best.subjectName}) — ${pct}%. Focus on the pending chapters to climb the leaderboard!`);
        } else {
          setInsight(`No quiz results yet, ${fullName}. Complete a quiz to see your insights here!`);
        }
      })
      .catch(() => setInsight('Could not load insights. Make sure the backend is running.'));
  }, [user?.userId, fullName, std, board]);

  // ── Derived data ──────────────────────────────────────────
  // Map: subjectName -> array of progress entries for this user
  const progressBySubject = progress.reduce((acc, p) => {
    if (!acc[p.subjectName]) acc[p.subjectName] = [];
    acc[p.subjectName].push(p);
    return acc;
  }, {});

  // Build per-subject stats using curriculum as source of truth for total
  const subjectStats = curriculum.map(subj => {
    const attempted = progressBySubject[subj.subjectName] || [];
    
    // Get unique chapters that have at least one 'isCompleted' record
    const uniqueCompletedChapters = new Set(
      attempted.filter(p => p.isCompleted).map(p => p.chapterName)
    );
    const completed = uniqueCompletedChapters.size;
    
    const totalChapters = subj.chapters.length;
    const avg = attempted.length > 0
      ? Math.round(attempted.reduce((s, p) => s + (p.totalQuestions > 0 ? (p.quizScore / p.totalQuestions) * 100 : 0), 0) / attempted.length)
      : 0;
    return {
      name: subj.subjectName,
      completed,
      total: totalChapters,
      avg,
      attempted,
      allChapters: subj.chapters
    };
  });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-4xl font-black uppercase mb-2 tracking-tight">Progress Insights</h1>
      <p className="font-bold text-gray-500 mb-6 md:mb-8 uppercase text-xs md:text-sm">{fullName}'s Journey</p>

      {/* ── AI Insight ─────────────────────────────────── */}
      <div className="card-bub-solid bg-gradient-to-r from-amber-400 to-orange-400 p-8 mb-10 relative transform -rotate-1">
        <span className="absolute -top-6 -left-4 text-5xl">🧠</span>
        <h2 className="text-xl font-black uppercase mb-2 ml-8">AI Performance Insight</h2>
        <p className="font-bold text-lg ml-8 opacity-80">{insight}</p>
      </div>

      {/* ── Section 1: Chapters Completed ─────────────── */}
      <h2 className="text-2xl font-black uppercase mb-6 bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-2 inline-block  border-b-8">
        Chapters Completed
      </h2>
      <div className="space-y-4 mb-12">
        {subjectStats.length === 0 ? (
          <div className="card-bub-solid border-dashed bg-white p-8 font-bold text-gray-400 text-center">
            No progress data yet — take a quiz!
          </div>
        ) : subjectStats.map((subj) => {
          const pct = subj.total > 0 ? Math.round((subj.completed / subj.total) * 100) : 0;
          return (
            <div key={subj.name} className="card-bub-solid bg-white p-6 hover:-translate-y-1 transition-transform">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="font-black text-2xl">{subj.name}</h3>
                  <p className="font-bold text-gray-500 text-sm">{subj.completed} of {subj.total} chapters completed</p>
                </div>
                <span className="text-3xl font-black">{pct}%</span>
              </div>
              {/* Progress bar */}
              <div className="h-4  bg-gray-100 w-full mb-4">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {/* All chapters from curriculum, show score if attempted */}
              <div className="flex flex-wrap gap-2">
                {subj.allChapters.map((ch, i) => {
                  const attemptedEntry = subj.attempted.find(a => a.chapterName === ch.chapterName);
                  return (
                    <span
                      key={i}
                      className={`border border-gray-200 text-xs font-black px-3 py-1 ${
                        attemptedEntry
                          ? attemptedEntry.isCompleted
                            ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                            : 'bg-gray-200 text-gray-600'
                          : 'bg-white text-gray-400'
                      }`}
                    >
                      {attemptedEntry
                        ? (attemptedEntry.isCompleted ? '✅' : '⏳')
                        : '○'}{' '}
                      {ch.chapterName}
                      {attemptedEntry ? ` (${attemptedEntry.quizScore}/${attemptedEntry.totalQuestions})` : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Section 2: Recharts Bar Chart ─────────────── */}
      <h2 className="text-2xl font-black uppercase mb-6 bg-gradient-to-r from-blue-400 to-cyan-400 text-black px-4 py-2 inline-block  border-b-8">
        Avg Quiz Score per Subject
      </h2>
      {subjectStats.length === 0 ? (
        <div className="card-bub-solid border-dashed bg-white p-10 font-bold text-gray-400 text-center">
          No scores yet — complete a quiz!
        </div>
      ) : (
        <div className="card-bub-solid bg-white p-6" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjectStats} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" stroke="#e5e5e5" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontWeight: 900, fontSize: 14, fontFamily: 'inherit' }}
                axisLine={{ stroke: '#000', strokeWidth: 3 }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}
                axisLine={{ stroke: '#000', strokeWidth: 3 }}
                tickLine={false}
                unit="%"
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="avg" radius={0} strokeWidth={3} stroke="#000" maxBarSize={72}>
                {subjectStats.map((_, idx) => (
                  <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default ProgressPage;
