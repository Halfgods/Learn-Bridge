import { useState, useEffect } from 'react';
import { getUser, authFetch } from '../utils/auth';
import ConceptMapCanvas from '../components/ConceptMapCanvas';
import { backendUrl } from '../config/api';

const KnowledgeGraphPage = () => {
  const user = getUser();
  const std = user?.std || 10;
  const board = user?.board || 'CBSE';

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [progressMap, setProgressMap] = useState({});
  const [gapAnalysis, setGapAnalysis] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingGaps, setLoadingGaps] = useState(false);

  const SUBJECT_COLORS = ['bg-gradient-to-r from-amber-400 to-orange-400', 'bg-gradient-to-r from-pink-500 to-rose-500 text-white', 'bg-gradient-to-r from-blue-400 to-cyan-400', 'bg-gray-800 text-white', 'bg-green-400'];

  // Load available subjects
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetch(backendUrl(`/api/knowledge-graph/subjects?std=${std}&board=${board}`), { signal: controller.signal })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setSubjects(arr);
        if (arr.length > 0) setSelectedSubject(arr[0]);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setLoading(false);
      });

    return () => controller.abort();
  }, [std, board]);

  // Load graph + progress when subject changes
  useEffect(() => {
    if (!selectedSubject) return;

    const controller = new AbortController();

    Promise.all([
      fetch(backendUrl(`/api/knowledge-graph?std=${std}&board=${board}&subject=${encodeURIComponent(selectedSubject)}`), { signal: controller.signal })
        .then(r => r.ok ? r.json() : { nodes: [] }),
      authFetch(backendUrl('/api/progress'))
        .then(r => r.ok ? r.json() : [])
    ]).then(([graph, progress]) => {
      setGraphData(graph);

      const pMap = {};
      (Array.isArray(progress) ? progress : []).forEach(p => {
        if (p.subjectName === selectedSubject) {
          const pct = p.totalQuestions > 0 ? Math.round((p.quizScore / p.totalQuestions) * 100) : 0;
          if (!pMap[p.chapterName] || pct > pMap[p.chapterName]) {
            pMap[p.chapterName] = pct;
          }
        }
      });
      setProgressMap(pMap);
      setGapAnalysis(null);
      setSelectedNode(null);
    }).catch(err => {
      if (err.name === 'AbortError') return;
      console.error(err);
    });

    return () => controller.abort();
  }, [selectedSubject, std, board]);

  // Run gap analysis
  const runGapAnalysis = async () => {
    if (!user?.userId) return;
    setLoadingGaps(true);
    try {
      const res = await authFetch(backendUrl(`/api/knowledge-graph/gaps?subject=${encodeURIComponent(selectedSubject)}`));
      const data = await res.json();
      setGapAnalysis(data);
    } catch (err) {
      console.error('Gap analysis error:', err);
    }
    setLoadingGaps(false);
  };

  const weakChapterNames = gapAnalysis?.weakChapters?.map(w => w.chapterName) || [];

  // Validate difficulty for selectedNode
  const safeDifficulty = selectedNode ? Math.max(0, Math.min(5, Number(selectedNode.difficulty) || 0)) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-violet-400 rounded-full animate-spin mb-4 mx-auto"></div>
          <h2 className="text-2xl font-black uppercase">Loading Knowledge Graph...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-24 lg:pb-8 h-[calc(100dvh-56px)] lg:h-[calc(100vh)] flex flex-col">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight mb-2">🧠 Concept Map</h1>
        <p className="font-bold text-gray-500 text-xs md:text-sm">Std {std} · {board} — Visualize prerequisite chains and find your weak spots</p>
      </div>

      {/* Subject Selector */}
      <div className="flex gap-2 md:gap-3 mb-6 border-b-4 border-black pb-6 overflow-x-auto scrollbar-hide -mx-4 md:mx-0 px-4 md:px-0">
        {subjects.map((subj, idx) => (
          <button
            key={subj}
            onClick={() => setSelectedSubject(subj)}
            className={`font-black text-sm md:text-base px-4 md:px-6 py-3 min-h-[44px] shrink-0 transition-all active:translate-y-0.5 ${
              subj === selectedSubject
                ? `${SUBJECT_COLORS[idx % SUBJECT_COLORS.length]} -translate-y-0.5`
                : 'bg-white hover:bg-gray-100 border-2 border-transparent'
            }`}
          >
            {subj}
          </button>
        ))}

        {/* Gap Analysis Button */}
        <button
          onClick={runGapAnalysis}
          disabled={loadingGaps}
          className="lg:ml-auto font-black text-sm md:text-base px-4 md:px-6 py-3 min-h-[44px] shrink-0 bg-red-400 text-white hover:bg-red-500 shadow-lg hover:-translate-y-0.5 transition-all active:translate-y-0"
        >
          {loadingGaps ? '⏳ Analyzing...' : '🔍 Gap Analysis'}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
        {/* Graph Area */}
        <div className="flex-1 card-bub-solid bg-white p-2 relative" style={{ minHeight: '400px' }}>
          {graphData?.nodes?.length > 0 ? (
            <>
              <ConceptMapCanvas
                nodes={graphData.nodes}
                progressMap={progressMap}
                onNodeClick={setSelectedNode}
                weakChapters={weakChapterNames}
              />
              {/* Legend */}
              <div className="absolute bottom-4 left-4 flex gap-3 bg-white/90 border border-gray-200 p-3">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-400 border border-black"></div><span className="text-xs font-bold">Mastered</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-400 border border-black"></div><span className="text-xs font-bold">Learning</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gradient-to-r from-pink-500 to-rose-500 border border-black"></div><span className="text-xs font-bold">Weak</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-300 border border-black"></div><span className="text-xs font-bold">Not tried</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 border border-black"></div><span className="text-xs font-bold">Gap</span></div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <span className="text-6xl mb-4 block">🗺️</span>
                <h3 className="font-black text-xl uppercase mb-2">No Knowledge Graph Available</h3>
                <p className="font-bold text-gray-500">Run the seed script to generate concept maps for this subject.</p>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-4 overflow-y-auto">
          {/* Selected Node Info */}
          {selectedNode && (
            <div className="card-bub-solid bg-white p-5">
              <h3 className="font-black text-lg mb-3 border-b-4 border-black pb-2">{selectedNode.chapterName}</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-black uppercase text-xs text-gray-500">Score</p>
                  <p className="font-black text-2xl">{selectedNode.score >= 0 ? `${selectedNode.score}%` : 'Not attempted'}</p>
                </div>
                <div>
                  <p className="font-black uppercase text-xs text-gray-500">Difficulty</p>
                  <p className="font-bold">{'★'.repeat(safeDifficulty)}{'☆'.repeat(5 - safeDifficulty)}</p>
                </div>
                <div>
                  <p className="font-black uppercase text-xs text-gray-500 mb-1">Key Concepts</p>
                  <div className="flex flex-wrap gap-1">
                    {(selectedNode.concepts || []).map((c, i) => (
                      <span key={i} className="text-xs border border-gray-200 bg-gradient-to-r from-amber-400 to-orange-400 px-2 py-0.5 font-bold">{c}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-black uppercase text-xs text-gray-500 mb-1">Prerequisites</p>
                  {(selectedNode.prerequisites || []).length > 0 ? (
                    <div className="space-y-1">
                      {selectedNode.prerequisites.map((p, i) => (
                        <div key={i} className={`text-xs border border-gray-200 px-2 py-1 font-bold ${(progressMap[p] || 0) >= 70 ? 'bg-green-200' : 'bg-red-200'}`}>
                          {(progressMap[p] || 0) >= 70 ? '✅' : '⚠️'} {p}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-gray-400">No prerequisites — start here!</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Gap Analysis Results */}
          {gapAnalysis && (
            <div className="card-bub-solid bg-red-50 p-5">
              <h3 className="font-black text-lg mb-3 text-red-700">🔍 Gap Analysis</h3>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="font-bold text-sm">Total Chapters</span>
                  <span className="font-black">{gapAnalysis.totalNodes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-sm">Mastered</span>
                  <span className="font-black text-green-600">{gapAnalysis.masteredNodes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-sm">Weak/Missing</span>
                  <span className="font-black text-red-600">{gapAnalysis.weakChapters?.length || 0}</span>
                </div>
              </div>

              {gapAnalysis.prerequisiteGaps?.length > 0 && (
                <div>
                  <p className="font-black uppercase text-xs text-red-700 mb-2">Missing Prerequisites</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {gapAnalysis.prerequisiteGaps.map((gap, i) => (
                      <div key={i} className="border-2 border-red-300 bg-white p-3 text-xs">
                        <p className="font-black text-red-700 mb-1">⚠️ {gap.recommendation}</p>
                        <p className="font-bold text-gray-500">
                          "{gap.missingPrerequisite}" score: {gap.prereqScore}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {gapAnalysis.prerequisiteGaps?.length === 0 && gapAnalysis.weakChapters?.length > 0 && (
                <p className="text-sm font-bold text-gray-600">No missing prerequisites found. Focus on practicing the weak chapters directly!</p>
              )}
            </div>
          )}

          {/* Stats */}
          {graphData?.nodes?.length > 0 && (
            <div className="card-bub-solid bg-amber-50 p-5">
              <h3 className="font-black text-sm uppercase mb-3">📊 Mastery Overview</h3>
              <div className="space-y-2">
                {graphData.nodes.map((n, i) => {
                  const score = progressMap[n.chapterName] ?? -1;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 h-3 border border-gray-200 bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${score >= 70 ? 'bg-green-400' : score >= 40 ? 'bg-gradient-to-r from-amber-400 to-orange-400' : score >= 0 ? 'bg-gradient-to-r from-pink-500 to-rose-500' : 'bg-gray-300'}`}
                          style={{ width: score >= 0 ? `${score}%` : '0%' }}
                        />
                      </div>
                      <span className="text-xs font-bold w-8 text-right">{score >= 0 ? `${score}%` : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphPage;
