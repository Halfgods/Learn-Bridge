import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Brain } from "lucide-react";
import { apiPath, parseApiJson } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import ConceptMapCanvas, { type GraphNode } from "@/components/ConceptMapCanvas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/concept-map")({
  head: () => ({ meta: [{ title: "Concept Map \u2014 Nova Learn" }] }),
  component: ConceptMapPage,
});

type GapResult = {
  totalNodes: number;
  masteredNodes: number;
  weakChapters: { chapterName: string }[];
  prerequisiteGaps: {
    recommendation: string;
    missingPrerequisite: string;
    prereqScore: number;
  }[];
};

const SUBJECT_COLORS = [
  "gradient-primary text-white",
  "gradient-cyan text-white",
  "gradient-yellow text-amber-900",
  "gradient-peach text-orange-900",
  "gradient-mint text-emerald-900",
  "bg-gray-800 text-white",
];

function ConceptMapPage() {
  const { data: user } = useMe();
  const std = user?.grade ?? 10;
  const board = user?.board ?? "CBSE";

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [gapResult, setGapResult] = useState<GapResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<(GraphNode & { score: number; isWeak: boolean }) | null>(null);
  const [loadingGaps, setLoadingGaps] = useState(false);

  const subjectsQ = useQuery({
    queryKey: ["kg-subjects", std, board],
    queryFn: async () => {
      const res = await fetch(apiPath(`/api/knowledge-graph/subjects?std=${std}&board=${board}`));
      const data = await parseApiJson<string[]>(res);
      return Array.isArray(data) ? data : [];
    },
  });

  const graphQ = useQuery({
    queryKey: ["kg-graph", std, board, selectedSubject],
    queryFn: async () => {
      const res = await fetch(
        apiPath(`/api/knowledge-graph?std=${std}&board=${board}&subject=${encodeURIComponent(selectedSubject!)}`),
      );
      const data = await parseApiJson<{ nodes?: GraphNode[] }>(res);
      return data;
    },
    enabled: !!selectedSubject,
  });

  const progressQ = useQuery({
    queryKey: ["progress"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath("/api/progress"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiJson<any[]>(res);
      return Array.isArray(data) ? data : [];
    },
  });

  useEffect(() => {
    if (subjectsQ.data && subjectsQ.data.length > 0 && !selectedSubject) {
      setSelectedSubject(subjectsQ.data[0]);
    }
  }, [subjectsQ.data, selectedSubject]);

  useEffect(() => {
    if (!graphQ.data || !selectedSubject) return;
    setGapResult(null);
    setSelectedNode(null);
  }, [graphQ.data, selectedSubject]);

  useEffect(() => {
    if (!progressQ.data || !selectedSubject) {
      setProgressMap({});
      return;
    }
    const pMap: Record<string, number> = {};
    progressQ.data.forEach((p: any) => {
      if (p.subjectName === selectedSubject) {
        const pct = p.totalQuestions > 0 ? Math.round((p.quizScore / p.totalQuestions) * 100) : 0;
        if (!pMap[p.chapterName] || pct > pMap[p.chapterName]) {
          pMap[p.chapterName] = pct;
        }
      }
    });
    setProgressMap(pMap);
  }, [progressQ.data, selectedSubject]);

  const runGapAnalysis = async () => {
    if (!selectedSubject) return;
    setLoadingGaps(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        apiPath(`/api/knowledge-graph/gaps?subject=${encodeURIComponent(selectedSubject)}`),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await parseApiJson<GapResult>(res);
      setGapResult(data);
    } catch {
      /* ignore */
    }
    setLoadingGaps(false);
  };

  const subjects = subjectsQ.data ?? [];
  const graphNodes = graphQ.data?.nodes ?? [];
  const weakNames = gapResult?.weakChapters?.map((w) => w.chapterName) ?? [];
  const safeDifficulty = selectedNode ? Math.max(0, Math.min(5, Number(selectedNode.difficulty) || 0)) : 0;
  const subjectsError = subjectsQ.error;
  const graphError = graphQ.error;
  const subjectsLoading = subjectsQ.isLoading;

  return (
    <div className="p-4 md:p-6 lg:p-8 pb-24 lg:pb-6 h-[calc(100dvh-56px)] lg:h-screen flex flex-col">
      <header className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1 flex items-center gap-3">
          <Brain className="w-8 h-8 text-clay-purple" /> Concept Map
        </h1>
        <p className="text-sm text-muted-foreground font-bold">
          Std {std} \u00B7 {board} \u2014 Visualize prerequisite chains and find weak spots
        </p>
      </header>

      <div className="flex gap-2 md:gap-3 mb-4 md:mb-6 overflow-x-auto scrollbar-hide -mx-4 md:mx-0 px-4 md:px-0 pb-2">
        {subjectsLoading ? (
          <div className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading subjects...
          </div>
        ) : subjectsError ? (
          <p className="text-sm font-bold text-destructive px-4 py-3">Failed to load subjects. Is the backend running?</p>
        ) : (
          subjects.map((subj, idx) => (
            <button
              key={subj}
              onClick={() => setSelectedSubject(subj)}
              className={cn(
                "font-black text-sm md:text-base px-4 md:px-6 py-3 shrink-0 rounded-2xl transition-all active:scale-95 clay-sm",
                subj === selectedSubject
                  ? `${SUBJECT_COLORS[idx % SUBJECT_COLORS.length]}`
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {subj}
            </button>
          ))
        )}
        {subjects.length > 0 && (
          <button
            onClick={runGapAnalysis}
            disabled={loadingGaps}
            className="font-black text-sm md:text-base px-4 md:px-6 py-3 shrink-0 rounded-2xl clay-sm bg-destructive text-destructive-foreground hover:opacity-90 transition-all active:scale-95 flex items-center gap-2"
          >
            {loadingGaps ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {loadingGaps ? "Analyzing..." : "Gap Analysis"}
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
        <div className="flex-1 clay-lg bg-card p-2 relative overflow-hidden rounded-[inherit]" style={{ minHeight: "400px" }}>
          {subjectsLoading || (graphQ.isLoading && selectedSubject) ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : graphError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-destructive" />
                <h3 className="font-black text-lg mb-1">Could not load graph</h3>
                <p className="font-bold text-muted-foreground text-sm">
                  The backend returned an error. Make sure the server is running and seeded with curriculum data.
                </p>
              </div>
            </div>
          ) : graphNodes.length > 0 ? (
            <>
              <ConceptMapCanvas
                nodes={graphNodes}
                progressMap={progressMap}
                onNodeClick={setSelectedNode}
                weakChapters={weakNames}
              />
              <div className="absolute bottom-4 left-4 flex flex-wrap gap-3 bg-card/90 clay-sm p-2 text-xs">
                <span className="flex items-center gap-1 font-bold">
                  <span className="w-3 h-3 rounded bg-green-400 border border-border" /> Mastered
                </span>
                <span className="flex items-center gap-1 font-bold">
                  <span className="w-3 h-3 rounded bg-amber-400 border border-border" /> Learning
                </span>
                <span className="flex items-center gap-1 font-bold">
                  <span className="w-3 h-3 rounded bg-rose-400 border border-border" /> Weak
                </span>
                <span className="flex items-center gap-1 font-bold">
                  <span className="w-3 h-3 rounded bg-gray-300 border border-border" /> Not tried
                </span>
                <span className="flex items-center gap-1 font-bold">
                  <span className="w-3 h-3 rounded bg-red-500 border border-border" /> Gap
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-black text-xl mb-2">No Knowledge Graph Available</h3>
                <p className="font-bold text-muted-foreground text-sm">
                  {subjects.length === 0
                    ? "No subjects found for your grade. Make sure curriculum data is seeded."
                    : "No chapter data found for this subject."}
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="w-full lg:w-80 flex-shrink-0 space-y-4 overflow-y-auto">
          {selectedNode && (
            <div className="clay-lg bg-card p-5">
              <h3 className="font-extrabold text-lg mb-3 border-b border-border pb-2">{selectedNode.chapterName}</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-black uppercase text-xs text-muted-foreground">Score</p>
                  <p className="font-black text-2xl">{selectedNode.score >= 0 ? `${selectedNode.score}%` : "Not attempted"}</p>
                </div>
                <div>
                  <p className="font-black uppercase text-xs text-muted-foreground">Difficulty</p>
                  <p className="font-bold text-lg">
                    {"\u2605".repeat(safeDifficulty)}
                    {"\u2606".repeat(5 - safeDifficulty)}
                  </p>
                </div>
                <div>
                  <p className="font-black uppercase text-xs text-muted-foreground mb-1">Key Concepts</p>
                  <div className="flex flex-wrap gap-1">
                    {(selectedNode.concepts || []).map((c, i) => (
                      <span key={i} className="text-xs clay-sm px-2 py-0.5 font-bold gradient-yellow text-amber-900">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-black uppercase text-xs text-muted-foreground mb-1">Prerequisites</p>
                  {(selectedNode.prerequisites || []).length > 0 ? (
                    <div className="space-y-1">
                      {selectedNode.prerequisites.map((p, i) => {
                        const prereqScore = progressMap[p] || 0;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "text-xs rounded-2xl px-2 py-1 font-bold border",
                              prereqScore >= 70 ? "bg-green-100 border-green-300 text-green-800" : "bg-red-100 border-red-300 text-red-800",
                            )}
                          >
                            {prereqScore >= 70 ? "\u2705" : "\u26A0\uFE0F"} {p}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-muted-foreground">No prerequisites \u2014 start here!</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {gapResult && (
            <div className="clay-lg bg-destructive/5 p-5 border border-destructive/20">
              <h3 className="font-extrabold text-lg mb-3 text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Gap Analysis
              </h3>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="font-bold text-sm">Total Chapters</span>
                  <span className="font-black">{gapResult.totalNodes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-sm">Mastered</span>
                  <span className="font-black text-green-600">{gapResult.masteredNodes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-sm">Weak/Missing</span>
                  <span className="font-black text-destructive">{gapResult.weakChapters?.length || 0}</span>
                </div>
              </div>
              {gapResult.prerequisiteGaps?.length > 0 && (
                <div>
                  <p className="font-black uppercase text-xs text-destructive mb-2">Missing Prerequisites</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {gapResult.prerequisiteGaps.map((gap, i) => (
                      <div key={i} className="clay-sm bg-card p-3 border border-destructive/30">
                        <p className="font-black text-destructive text-xs mb-1">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          {gap.recommendation}
                        </p>
                        <p className="font-bold text-xs text-muted-foreground">
                          &ldquo;{gap.missingPrerequisite}&rdquo; score: {gap.prereqScore}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(!gapResult.prerequisiteGaps || gapResult.prerequisiteGaps.length === 0) &&
                gapResult.weakChapters?.length > 0 && (
                  <p className="text-sm font-bold text-muted-foreground">
                    No missing prerequisites found. Focus on practicing the weak chapters directly!
                  </p>
                )}
            </div>
          )}

          {graphNodes.length > 0 && (
            <div className="clay-lg bg-card p-5">
              <h3 className="font-extrabold text-sm uppercase mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4" /> Mastery Overview
              </h3>
              <div className="space-y-2">
                {graphNodes.map((n, i) => {
                  const score = progressMap[n.chapterName] ?? -1;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 h-3 rounded-full clay-pressed overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            score >= 70 ? "bg-green-400" : score >= 40 ? "gradient-yellow" : score >= 0 ? "bg-rose-400" : "bg-muted",
                          )}
                          style={{ width: score >= 0 ? `${score}%` : "0%" }}
                        />
                      </div>
                      <span className="text-xs font-bold w-8 text-right text-muted-foreground">
                        {score >= 0 ? `${score}%` : "\u2014"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
