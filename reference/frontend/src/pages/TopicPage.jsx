import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { authFetch, getUser } from '../utils/auth';
import { backendUrl } from '../config/api';
import PdfViewer from '../components/PdfViewer';

const SUBJECT_COLORS = ['bg-gradient-to-r from-amber-400 to-orange-400', 'bg-gradient-to-r from-pink-500 to-rose-500', 'bg-gradient-to-r from-blue-400 to-cyan-400', 'bg-gradient-to-r from-purple-400 to-violet-500'];

const STAR_LABELS = { 1:'🌱 Sprout', 2:'🌿 Learner', 3:'🌳 Star', 4:'⭐ Superstar', 5:'👑 Genius' };

const TopicPage = () => {
  const [curriculum, setCurriculum] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [adaptiveChapters, setAdaptiveChapters] = useState(null);
  const [starLevel, setStarLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAdaptive, setLoadingAdaptive] = useState(false);
  const [error, setError] = useState(null);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const fetchKeyRef = useRef(0);

  const retryFetch = () => {
    fetchKeyRef.current += 1;
    setLoading(true);
    setError(null);
    fetch(backendUrl(`/api/curriculum?std=${std}&board=${board}`))
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => { setCurriculum(data); if (data.length > 0) setSelectedSubject(data[0].subjectName); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  };
  const user = getUser();
  const std = user?.std || 10;
  const board = user?.board || 'CBSE';

  const handleOpenPdf = async (chapterName) => {
    setPdfLoading(true);
    try {
      const res = await fetch(backendUrl(`/api/pdf?std=${std}&subject=${encodeURIComponent(selectedSubject)}&chapter=${encodeURIComponent(chapterName)}`));
      if (!res.ok) throw new Error('PDF not available');
      const data = await res.json();
      setPdfInfo(data);
      setShowPdf(true);
    } catch (err) {
      setPdfInfo({ error: err.message, title: chapterName });
      setShowPdf(true);
    }
    setPdfLoading(false);
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(backendUrl(`/api/curriculum?std=${std}&board=${board}`), { signal: controller.signal })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setCurriculum(arr);
        if (arr.length > 0) setSelectedSubject(arr[0].subjectName);
        setLoading(false);
      })
      .catch(err => { if (err.name === 'AbortError') return; console.error(err); setError(err.message); setLoading(false); });

    return () => controller.abort();
  }, [std, board]);

  // Fetch adaptive chapters when subject changes
  useEffect(() => {
    if (!selectedSubject) return;
    setLoadingAdaptive(true);
    setAdaptiveChapters(null);
    authFetch(backendUrl(`/api/curriculum/adaptive?subject=${encodeURIComponent(selectedSubject)}`))
      .then(res => res.ok ? res.json() : { chapters: [] })
      .then(data => {
        setAdaptiveChapters(data.chapters || []);
        setStarLevel(data.starLevel || 1);
        setLoadingAdaptive(false);
      })
      .catch(() => setLoadingAdaptive(false));
  }, [selectedSubject]);

  const activeSubject = curriculum.find(s => s.subjectName === selectedSubject);

  const getChapterCardStyle = (status) => {
    switch (status) {
      case 'mastered': return 'border-green-300 bg-green-50 opacity-80';
      case 'ready': return 'border-violet-300 bg-white';
      case 'challenge': return 'border-amber-400 bg-amber-50 ring-2 ring-amber-400';
      case 'locked': return 'border-gray-200 bg-gray-100 opacity-60';
      default: return 'border-gray-200 bg-white';
    }
  };

  const getStatusBadge = (status, minStar) => {
    switch (status) {
      case 'mastered': return <span className="text-xs font-bold text-green-600">✅ Mastered</span>;
      case 'ready': return <span className="text-xs font-bold text-violet-600">📖 Ready</span>;
      case 'challenge': return <span className="text-xs font-bold text-amber-600 animate-pulse">🔥 Challenge</span>;
      case 'locked': return <span className="text-xs font-bold text-gray-400">🔒 Needs ⭐{minStar}</span>;
      default: return null;
    }
  };

  const sortedChapters = adaptiveChapters
    ? [...adaptiveChapters].sort((a, b) => {
        const order = { mastered: 0, ready: 1, challenge: 2, locked: 3 };
        return (order[a.status] || 0) - (order[b.status] || 0);
      })
    : [];

  return (
    <div className="p-4 md:p-8 pb-24 lg:pb-20">
      <div className="flex items-center justify-between mb-2 gap-3">
        <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight">Subjects</h1>
        {starLevel && <div className="text-sm md:text-lg font-bold px-3 md:px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-400 shadow-lg shrink-0">{STAR_LABELS[starLevel] || '🌱 Sprout'}</div>}
      </div>
      <p className="font-bold text-gray-600 mb-4 md:mb-8 text-sm md:text-base">Std {std} · {board}</p>

      {/* Subject Selector — horizontal scroll on mobile */}
      <div className="flex gap-2 md:gap-4 mb-6 md:mb-8 pb-4 md:pb-6 border-b border-gray-200 overflow-x-auto scrollbar-hide -mx-4 md:mx-0 px-4 md:px-0">
        {curriculum.map((subject, idx) => {
          const isActive = subject.subjectName === selectedSubject;
          return (
            <button key={idx} onClick={() => setSelectedSubject(subject.subjectName)}
              className={`font-bold text-sm md:text-base px-4 md:px-6 py-3 min-h-[44px] shrink-0 transition-all ${isActive ? SUBJECT_COLORS[idx % SUBJECT_COLORS.length] + ' text-white shadow-lg scale-105' : 'bg-white hover:bg-gray-100 shadow-sm border-2 border-gray-200'}`}>
              {subject.subjectName}
            </button>
          );
        })}
      </div>

      {/* Chapter Grid */}
      {activeSubject ? (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xl md:text-2xl font-black">{activeSubject.subjectName}</h2>
            <span className="text-xs md:text-sm font-bold text-gray-400">
              {sortedChapters.filter(c => c.status !== 'locked').length}/{sortedChapters.length} available
            </span>
          </div>

          {loadingAdaptive ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-gray-200 border-t-violet-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="font-bold">Loading your personalized curriculum...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {sortedChapters.map((chapter, cIdx) => {
                const isLocked = chapter.status === 'locked';
                return (
                  <div key={cIdx}
                    className={`rounded-2xl border-2 flex flex-col justify-between transition-all ${getChapterCardStyle(chapter.status)} ${!isLocked ? 'active:scale-[0.98] md:hover:-translate-y-1 md:hover:shadow-lg' : ''}`}>
                    <div className="p-4 md:p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-base md:text-lg font-black opacity-60">#{cIdx + 1}</span>
                        {getStatusBadge(chapter.status, chapter.minStarLevel)}
                      </div>
                      <h3 className="font-bold text-base md:text-lg mb-1 leading-snug">{chapter.chapterName}</h3>
                      {chapter.description && <p className="text-xs md:text-sm text-gray-500">{chapter.description}</p>}
                    </div>
                    {!isLocked ? (
                      <div className="flex border-t border-gray-200">
                        <button onClick={() => handleOpenPdf(chapter.chapterName)} disabled={pdfLoading}
                          className="flex-1 text-center font-bold py-3 text-xs min-h-[44px] hover:bg-green-100 border-r border-gray-200 transition-colors">📄 PDF</button>
                        <Link to={`/dashboard/learn/${encodeURIComponent(selectedSubject)}/${encodeURIComponent(chapter.chapterName)}`}
                          className="flex-1 text-center font-bold py-3 text-xs min-h-[44px] flex items-center justify-center hover:bg-blue-100 border-r border-gray-200 transition-colors">🤖 Learn</Link>
                        <Link to={`/dashboard/quiz/${encodeURIComponent(selectedSubject)}/${encodeURIComponent(chapter.chapterName)}`}
                          className="flex-1 text-center font-bold py-3 text-xs min-h-[44px] flex items-center justify-center hover:bg-pink-100 transition-colors">⚡ Quiz</Link>
                      </div>
                    ) : (
                      <div className="p-4 text-center">
                        <span className="text-xs md:text-sm font-bold text-gray-400">Master earlier topics to unlock! ⭐{chapter.minStarLevel} needed</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="card-bub-solid p-10 text-center font-black text-xl">Loading curriculum...</div>
      ) : error ? (
        <div className="bg-red-100 rounded-2xl p-10 text-center text-red-700">
          <p className="font-black text-xl mb-4">Error: {error}</p>
          <button onClick={retryFetch} className="bg-white px-6 py-3 min-h-[44px] font-bold rounded-full shadow hover:shadow-lg transition-all">🔄 Retry</button>
        </div>
      ) : (
        <div className="card-bub-solid p-10 text-center font-black text-xl">No curriculum found for Std {std} · {board}</div>
      )}

      {showPdf && pdfInfo && (
        pdfInfo.error ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-3xl max-w-lg w-full p-8 text-center shadow-xl">
              <span className="text-5xl block mb-4">📄</span>
              <h3 className="font-black text-xl mb-2">PDF Not Available</h3>
              <p className="font-bold text-gray-600 mb-4">No NCERT PDF mapped for this chapter.</p>
              <button onClick={() => setShowPdf(false)} className="btn-bub-primary px-6 py-3 min-h-[44px]">Close</button>
            </div>
          </div>
        ) : (
          <PdfViewer directUrl={pdfInfo.ncertUrl} title={`NCERT Std ${std} ${pdfInfo.subjectName} - ${pdfInfo.chapterName}`} onClose={() => setShowPdf(false)} />
        )
      )}
    </div>
  );
};

export default TopicPage;
