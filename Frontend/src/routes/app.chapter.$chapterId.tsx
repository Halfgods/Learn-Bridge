import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  FileText,
  Download,
  Highlighter,
  NotebookPen,
  Youtube,
  ExternalLink,
  Sparkles,
  Clock,
  TrendingUp,
  AlertTriangle,
  Loader2,
  X,
  BookOpen,
  Brain,
  ArrowRight,
  CircleCheckBig,
  Pen,
  Save,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiPath, scrapperPath, parseApiJson } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { ClayButton } from "@/components/ClayButton";

export const Route = createFileRoute("/app/chapter/$chapterId")({
  head: () => ({ meta: [{ title: "Chapter — Nova Learn" }] }),
  component: Chapter,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      subjectName: (search.subjectName as string) || "Mathematics",
      std: Number(search.std) || 10,
    };
  },
});

function Chapter() {
  const { chapterId } = Route.useParams();
  const { subjectName, std } = Route.useSearch();
  const title = decodeURIComponent(chapterId);
  const navigate = useNavigate();

  const [selectedResource, setSelectedResource] = useState<"shaalaa" | "yt" | null>(null);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizPicked, setQuizPicked] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizDone, setQuizDone] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; total: number } | null>(null);
  const queryClient = useQueryClient();

  const { data: resourceData, isLoading: isResourceLoading } = useQuery({
    queryKey: ["scrapped-resources", selectedResource, std, subjectName, title],
    queryFn: async () => {
      const searchQuery = `${title} ${subjectName}`;
      if (selectedResource === "shaalaa") {
        const res = await fetch(
          `${scrapperPath("/shaalaalinks")}?std=${std}&query=${encodeURIComponent(searchQuery)}`,
        );
        return res.json();
      }
      if (selectedResource === "yt") {
        const res = await fetch(
          `${scrapperPath("/ytlinks")}?std=${std}&query=${encodeURIComponent(searchQuery)}`,
        );
        return res.json();
      }
      return null;
    },
    enabled: !!selectedResource,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["pdf", std, subjectName, title],
    queryFn: async () => {
      const res = await fetch(
        apiPath(
          `/api/content/pdf?std=${std}&subjectName=${encodeURIComponent(subjectName)}&chapterName=${encodeURIComponent(title)}`,
        ),
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load PDF");
      }
      const json = await res.json();
      const proxyUrl = apiPath(`/api/content/pdf/proxy?url=${encodeURIComponent(json.ncertUrl)}`);
      return { ...json, proxyUrl };
    },
  });

  const chapterQuizQ = useQuery({
    queryKey: ["chapter-quiz", std, subjectName, title],
    queryFn: async () => {
      const res = await fetch(
        apiPath(
          `/api/chapter/quiz?std=${std}&subject=${encodeURIComponent(subjectName)}&chapter=${encodeURIComponent(title)}`,
        ),
      );
      const data = await parseApiJson<{
        questions?: { q: string; options: string[]; correct: number }[];
      }>(res);
      return data.questions ?? [];
    },
    enabled: !quizDone,
  });

  const chapterProgressQ = useQuery({
    queryKey: ["chapter-progress"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) return [];
      const res = await fetch(apiPath("/api/chapter/progress"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiJson<any[]>(res);
      return Array.isArray(data) ? data : [];
    },
  });

  const chapterMut = useMutation({
    mutationFn: async (payload: {
      std: number;
      subject: string;
      chapter: string;
      score: number;
      total: number;
      answers: number[];
    }) => {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Login required");
      const res = await fetch(apiPath("/api/chapter/attempt"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const body = await parseApiJson<{ saved: boolean; score: number; total: number }>(res);
      if (!res.ok) throw new Error("Failed");
      return body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chapter-progress"] });
      queryClient.invalidateQueries({ queryKey: ["chapter-quiz"] });
      setQuizResult({ score: data.score, total: data.total });
      setQuizDone(true);
    },
  });

  const { data: me } = useMe();
  const isTeacher = me?.role === "teacher";
  const [teacherEditing, setTeacherEditing] = useState(false);
  const [teacherUrl, setTeacherUrl] = useState("");

  const teacherUpdateMut = useMutation({
    mutationFn: async (url: string) => {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Login required");
      const res = await fetch(apiPath("/api/content/pdf/update"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ std, subjectName, chapterName: title, ncertUrl: url }),
      });
      const body = await parseApiJson<{ status: string; updatedBy?: string; error?: string }>(res);
      if (!res.ok) throw new Error(body.error || "Update failed");
      return body;
    },
    onSuccess: () => {
      setTeacherEditing(false);
      queryClient.invalidateQueries({ queryKey: ["pdf", std, subjectName, title] });
    },
  });

  const activePdfUrl = data?.proxyUrl ?? null;

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <Link
        to="/app"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <header className="clay-lg bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl gradient-cyan text-white flex items-center justify-center clay-sm">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground">
              Class {std} • {subjectName}
            </p>
            <h1 className="text-2xl font-black">{title}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="h-11 w-11 rounded-2xl clay-sm bg-card flex items-center justify-center">
            <Highlighter className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate({ to: "/app/notebook" })}
            className="h-11 w-11 rounded-2xl clay-sm bg-card flex items-center justify-center"
          >
            <NotebookPen className="w-4 h-4" />
          </button>
          <button className="h-11 w-11 rounded-2xl clay-sm bg-card flex items-center justify-center">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* PDF viewer */}
      <section className="clay-lg bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-extrabold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              PDF Viewer
            </h2>
            {data?.matchedChapter && data.matchedChapter !== title ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Closest match:{" "}
                <span className="font-bold text-foreground">{data.matchedChapter}</span>
              </p>
            ) : null}
            {data?.updatedBy && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Updated by <span className="font-bold text-foreground/80">{data.updatedBy}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && !error && isTeacher && !teacherEditing && (
              <button
                onClick={() => {
                  setTeacherEditing(true);
                  setTeacherUrl(data?.ncertUrl || "");
                }}
                title="Update PDF link"
                className="h-9 px-3 rounded-xl clay-sm bg-card flex items-center gap-1.5 text-xs font-bold text-primary hover:scale-105 active:scale-95 transition-transform"
              >
                <Pen className="w-4 h-4" /> Edit
              </button>
            )}
            {teacherEditing && (
              <div className="flex items-center gap-2">
                <input
                  value={teacherUrl}
                  onChange={(e) => setTeacherUrl(e.target.value)}
                  placeholder="https://ncert.nic.in/textbook/pdf/..."
                  className="h-9 w-64 rounded-xl border-2 border-muted bg-background px-3 text-xs font-bold outline-none"
                />
                <button
                  onClick={() => teacherUpdateMut.mutate(teacherUrl)}
                  disabled={!teacherUrl.trim() || teacherUpdateMut.isPending}
                  className="h-9 px-3 rounded-xl clay-sm bg-card flex items-center gap-1.5 text-xs font-bold text-emerald-500 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {teacherUpdateMut.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save
                </button>
                <button
                  onClick={() => setTeacherEditing(false)}
                  className="h-9 px-3 rounded-xl clay-sm bg-card flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:scale-105 active:scale-95 transition-transform"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="aspect-[4/5] sm:aspect-[16/10] rounded-2xl clay-pressed bg-gradient-to-br from-muted to-card flex items-center justify-center relative overflow-hidden">
          {isLoading && <Loader2 className="w-8 h-8 animate-spin text-primary" />}
          {error && (
            <div className="text-destructive font-bold p-4 text-center">
              {(error as Error).message}
            </div>
          )}
          {!isLoading && !error && activePdfUrl && (
            <iframe
              key={activePdfUrl}
              src={activePdfUrl}
              className="w-full h-full border-0"
              title={data?.matchedChapter || title}
            />
          )}
          {!isLoading && !error && !activePdfUrl && (
            <div className="text-muted-foreground font-bold p-4 text-center">
              PDF not available for this chapter.
            </div>
          )}
        </div>
      </section>

      {/* Concept graph */}
      <section className="clay-lg bg-card p-6">
        <h2 className="font-extrabold mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Related concepts
        </h2>
        <ConceptGraph center={title} subjectName={subjectName} std={std} />
      </section>

      {/* Resources */}
      <section className="grid md:grid-cols-2 gap-4">
        <div className="clay-lg bg-card p-6 space-y-3">
          <h3 className="font-extrabold">Suggested resources</h3>
          {[
            {
              id: "shaalaa",
              icon: ExternalLink,
              label: "Shaalaa.com - links",
              color: "gradient-cyan text-white",
              disabled: false,
            },
            {
              id: "yt",
              icon: Youtube,
              label: "Youtube Links",
              color: "gradient-peach text-orange-900",
              disabled: false,
            },
            {
              id: "worksheet",
              icon: FileText,
              label: "Practice worksheet (PDF)",
              color: "gradient-mint text-emerald-900",
              disabled: true,
            },
          ].map((r) => (
            <button
              key={r.label}
              onClick={() => {
                if (!r.disabled) setSelectedResource(r.id as any);
              }}
              className="flex items-center w-full text-left gap-3 clay-sm bg-card p-3 hover:-translate-y-0.5 transition-transform"
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center",
                  r.color,
                  r.disabled && "opacity-50",
                )}
              >
                <r.icon className="w-5 h-5" />
              </div>
              <span className={cn("font-bold flex-1", r.disabled && "opacity-50")}>{r.label}</span>
              {!r.disabled && <ExternalLink className="w-4 h-4 text-muted-foreground" />}
            </button>
          ))}
        </div>
        <ChapterQuiz
          questions={chapterQuizQ.data ?? []}
          isLoading={chapterQuizQ.isLoading}
          idx={quizIdx}
          picked={quizPicked}
          setPicked={setQuizPicked}
          onNext={() => {
            if (quizPicked === null) return;
            const next = [...quizAnswers, quizPicked];
            setQuizAnswers(next);
            setQuizPicked(null);
            const qs = chapterQuizQ.data ?? [];
            if (quizIdx < qs.length - 1) {
              setQuizIdx(quizIdx + 1);
            } else {
              chapterMut.mutate({
                std,
                subject: subjectName,
                chapter: title,
                score: next.filter((a, i) => a === qs[i].correct).length,
                total: qs.length,
                answers: next,
              });
            }
          }}
          isSubmitting={chapterMut.isPending}
          done={quizDone}
          result={quizResult}
          onRetry={() => {
            setQuizDone(false);
            setQuizIdx(0);
            setQuizPicked(null);
            setQuizAnswers([]);
            setQuizResult(null);
          }}
        />
      </section>
      <section>
        <ChapterInsights
          chapterProgress={chapterProgressQ.data ?? []}
          chapterName={title}
          subjectName={subjectName}
        />
      </section>

      {/* Zoom-in Modal for Resources */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedResource(null)}
          />
          <div className="relative w-full max-w-lg clay-lg bg-card p-6 z-10 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {selectedResource === "shaalaa" ? (
                  <>
                    <ExternalLink className="w-5 h-5 text-cyan-500" /> Shaalaa.com Links
                  </>
                ) : (
                  <>
                    <Youtube className="w-5 h-5 text-red-500" /> YouTube Lectures
                  </>
                )}
              </h2>
              <button
                onClick={() => setSelectedResource(null)}
                className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isResourceLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {(() => {
                  if (selectedResource === "shaalaa") {
                    const links = (resourceData?.links as string[] | undefined) ?? [];
                    return (
                      <>
                        {links.map((href, idx) => (
                          <a
                            key={idx}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="block p-4 clay-sm bg-muted/50 rounded-xl hover:bg-muted hover:-translate-y-0.5 transition-all font-medium break-all text-primary hover:underline"
                          >
                            {href}
                          </a>
                        ))}
                        {!links.length && (
                          <p className="text-muted-foreground text-center py-8 font-medium">
                            No resources found for this chapter.
                          </p>
                        )}
                      </>
                    );
                  }

                  const videos = (
                    (resourceData?.videos as
                      | (string | { url?: string; title?: string })[]
                      | undefined) ?? []
                  )
                    .map((v) => ({
                      href: typeof v === "string" ? v : (v?.url ?? ""),
                      title: typeof v === "string" ? "" : (v?.title ?? ""),
                    }))
                    .filter((v) => v.href);

                  const getYoutubeId = (url: string) => {
                    const m = url.match(
                      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
                    );
                    return m ? m[1] : null;
                  };

                  return (
                    <>
                      {videos.map((v, idx) => {
                        const vid = getYoutubeId(v.href);
                        return (
                          <a
                            key={idx}
                            href={v.href}
                            target="_blank"
                            rel="noreferrer"
                            className="block clay-sm bg-card rounded-xl overflow-hidden hover:-translate-y-0.5 transition-all"
                          >
                            {vid ? (
                              <div className="aspect-video bg-muted relative">
                                <img
                                  src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`}
                                  alt={v.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="h-12 w-12 rounded-full bg-black/60 flex items-center justify-center">
                                    <div className="w-0 h-0 border-y-8 border-y-transparent border-l-[14px] border-l-white ml-1" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="h-24 flex items-center justify-center bg-muted text-muted-foreground font-bold text-sm">
                                Watch Video
                              </div>
                            )}
                            {v.title && (
                              <div className="p-3">
                                <p className="text-sm font-bold leading-snug line-clamp-2">
                                  {v.title}
                                </p>
                              </div>
                            )}
                          </a>
                        );
                      })}
                      {!videos.length && (
                        <p className="text-muted-foreground text-center py-8 font-medium">
                          No resources found for this chapter.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Insight({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-2xl p-3">
      <Icon className="w-4 h-4 mb-2 opacity-90" />
      <div className="text-xs opacity-90 font-bold">{label}</div>
      <div className="font-black">{value}</div>
    </div>
  );
}

function ChapterQuiz({
  questions,
  isLoading,
  idx,
  picked,
  setPicked,
  onNext,
  isSubmitting,
  done,
  result,
  onRetry,
}: {
  questions: { q: string; options: string[]; correct: number }[];
  isLoading: boolean;
  idx: number;
  picked: number | null;
  setPicked: (v: number | null) => void;
  onNext: () => void;
  isSubmitting: boolean;
  done: boolean;
  result: { score: number; total: number } | null;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="clay-lg bg-card p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (questions.length === 0) return null;

  if (done && result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div className="clay-lg bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <CircleCheckBig className="w-8 h-8 text-green-500" />
          <div>
            <h3 className="font-extrabold text-lg">Chapter Quiz Complete</h3>
            <p className="text-sm text-muted-foreground font-bold">
              {result.score}/{result.total} correct ({pct}%)
            </p>
          </div>
        </div>
        <div className="h-4 rounded-full clay-pressed bg-muted w-full">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct >= 70 ? "bg-green-400" : pct >= 40 ? "gradient-yellow" : "bg-rose-400",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <ClayButton variant="white" size="sm" onClick={onRetry}>
          Retry quiz
        </ClayButton>
      </div>
    );
  }

  const cur = questions[idx];
  if (!cur) return null;
  const progress = (idx / questions.length) * 100;

  return (
    <div className="clay-lg bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" /> Chapter Quiz
        </h3>
        <span className="text-xs font-bold text-muted-foreground">
          {idx + 1}/{questions.length}
        </span>
      </div>
      <div className="h-2 rounded-full clay-pressed bg-muted w-full">
        <div
          className="h-full rounded-full gradient-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="font-extrabold text-lg leading-snug">{cur.q}</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {cur.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPicked(i)}
            className={cn(
              "min-h-12 rounded-2xl font-bold text-left px-4 py-3 transition-all text-sm",
              picked === i
                ? "gradient-primary text-white glow-purple scale-[1.02]"
                : "clay-sm bg-card hover:-translate-y-0.5",
            )}
          >
            <span className="opacity-70 mr-2">{String.fromCharCode(65 + i)}.</span> {opt}
          </button>
        ))}
      </div>
      <ClayButton
        size="sm"
        className="w-full"
        disabled={picked === null || isSubmitting}
        onClick={onNext}
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : idx < questions.length - 1 ? (
          <>
            Next <ArrowRight className="w-4 h-4" />
          </>
        ) : (
          "Submit"
        )}
      </ClayButton>
    </div>
  );
}

function ChapterInsights({
  chapterProgress,
  chapterName,
  subjectName,
}: {
  chapterProgress: any[];
  chapterName: string;
  subjectName: string;
}) {
  const myAttempt = chapterProgress.find(
    (p: any) => p.chapterName === chapterName && p.subjectName === subjectName,
  );
  const totalChapters = new Set(chapterProgress.map((p: any) => p.chapterName)).size;
  const mastery = myAttempt
    ? Math.round((myAttempt.quizScore / myAttempt.totalQuestions) * 100)
    : 0;
  const completed = chapterProgress.filter((p: any) => p.isCompleted).length;

  return (
    <div className="clay-lg gradient-primary text-white p-6 space-y-4 relative overflow-hidden">
      <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full bg-white/20 blur-2xl" />
      <h3 className="font-extrabold relative">Learning insights</h3>
      <div className="grid grid-cols-2 gap-3 relative">
        <Insight icon={Clock} label="Chapters done" value={`${completed}`} />
        <Insight icon={TrendingUp} label="Mastery" value={myAttempt ? `${mastery}%` : "—"} />
        <Insight
          icon={AlertTriangle}
          label="This chapter"
          value={myAttempt ? `${mastery}%` : "Not attempted"}
        />
        <Insight icon={Sparkles} label="Attempts" value={`${chapterProgress.length}`} />
      </div>
    </div>
  );
}

function ConceptGraph({
  center,
  subjectName,
  std,
}: {
  center: string;
  subjectName: string;
  std: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["related-concepts", std, subjectName, center],
    queryFn: async () => {
      const res = await fetch(
        apiPath(
          `/api/content/related?std=${std}&subjectName=${encodeURIComponent(subjectName)}&chapterName=${encodeURIComponent(center)}`,
        ),
      );
      const body = await parseApiJson<{
        concepts?: { name: string; x: number; y: number; color: string }[];
      }>(res);
      if (!res.ok) throw new Error("Failed");
      return body.concepts ?? [];
    },
  });

  const nodes = data ?? [];
  const hasData = nodes.length > 0;

  return (
    <div className="relative aspect-[16/9] rounded-2xl clay-pressed bg-card overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
      {!isLoading && !hasData && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground font-bold">
          No related concepts found.
        </div>
      )}
      {hasData && (
        <>
          <svg
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            {nodes.map((n) => (
              <line
                key={n.name}
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                stroke="oklch(0.85 0.05 280)"
                strokeWidth="0.4"
                strokeDasharray="1 1"
              />
            ))}
          </svg>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-5 py-3 rounded-2xl gradient-primary text-white font-extrabold clay-sm glow-purple text-center max-w-[40%] leading-tight">
            {center}
          </div>
          {nodes.map((n) => (
            <div
              key={n.name}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1.5 rounded-xl font-bold text-xs clay-sm leading-tight text-center max-w-[28%]",
                n.color,
              )}
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              {n.name}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
