import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { ArrowLeft, FileText, Download, Highlighter, NotebookPen, Youtube, ExternalLink, Sparkles, Clock, TrendingUp, AlertTriangle, Loader2, X, ThumbsUp, ThumbsDown, CheckCircle2, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiPath, scrapperPath, parseApiJson } from "@/lib/api";

export const Route = createFileRoute("/app/chapter/$chapterId")({
  head: () => ({ meta: [{ title: "Chapter — Nova Learn" }] }),
  component: Chapter,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      subjectName: (search.subjectName as string) || "Mathematics",
      std: Number(search.std) || 10,
    }
  }
});

function Chapter() {
  const { chapterId } = Route.useParams();
  const { subjectName, std } = Route.useSearch();
  const title = decodeURIComponent(chapterId);
  
  const [selectedResource, setSelectedResource] = useState<'shaalaa' | 'yt' | null>(null);

  const { data: resourceData, isLoading: isResourceLoading } = useQuery({
    queryKey: ['scrapped-resources', selectedResource, std, title],
    queryFn: async () => {
      if (selectedResource === "shaalaa") {
        const res = await fetch(
          `${scrapperPath("/shaalaalinks")}?std=${std}&query=${encodeURIComponent(title)}`
        );
        return res.json();
      }
      if (selectedResource === "yt") {
        const res = await fetch(
          `${scrapperPath("/ytlinks")}?std=${std}&query=${encodeURIComponent(title)}`
        );
        return res.json();
      }
      return null;
    },
    enabled: !!selectedResource
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['pdf', std, subjectName, title],
    queryFn: async () => {
      const res = await fetch(apiPath(`/api/content/pdf?std=${std}&subjectName=${encodeURIComponent(subjectName)}&chapterName=${encodeURIComponent(title)}`));
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load PDF");
      }
      const json = await res.json();
      const proxyUrl = apiPath(`/api/content/pdf/proxy?url=${encodeURIComponent(json.ncertUrl)}`);
      return { ...json, proxyUrl };
    }
  });

  // PDF feedback state: 'idle' | 'confirming' | 'confirmed' | 'rejecting' | 'rejected'
  type FeedbackState = 'idle' | 'confirming' | 'confirmed' | 'rejecting' | 'rejected';
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [subjectPdfUrl, setSubjectPdfUrl] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    if (!data?.ncertUrl || feedback !== 'idle') return;
    setFeedback('confirming');
    try {
      await fetch(apiPath('/api/content/pdf/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          std,
          subjectName,
          chapterName: title,
          ncertUrl: data.ncertUrl,
        }),
      });
      setFeedback('confirmed');
    } catch {
      setFeedback('idle');
    }
  }, [data, std, subjectName, title, feedback]);

  const handleReject = useCallback(async () => {
    if (feedback !== 'idle') return;
    setFeedback('rejecting');
    try {
      const res = await fetch(apiPath(`/api/content/pdf/subject?std=${std}&subjectName=${encodeURIComponent(subjectName)}`));
      const json = await res.json();
      const url = apiPath(`/api/content/pdf/proxy?url=${encodeURIComponent(json.ncertUrl)}`);
      setSubjectPdfUrl(url);
      setFeedback('rejected');
    } catch {
      setFeedback('idle');
    }
  }, [std, subjectName, feedback]);

  // Which URL to show in the iframe
  const activePdfUrl = feedback === 'rejected' && subjectPdfUrl
    ? subjectPdfUrl
    : data?.proxyUrl ?? null;

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <Link to="/app" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <header className="clay-lg bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl gradient-cyan text-white flex items-center justify-center clay-sm">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground">Class {std} • {subjectName}</p>
            <h1 className="text-2xl font-black">{title}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="h-11 w-11 rounded-2xl clay-sm bg-card flex items-center justify-center"><Highlighter className="w-4 h-4"/></button>
          <button className="h-11 w-11 rounded-2xl clay-sm bg-card flex items-center justify-center"><NotebookPen className="w-4 h-4"/></button>
          <button className="h-11 w-11 rounded-2xl clay-sm bg-card flex items-center justify-center"><Download className="w-4 h-4"/></button>
        </div>
      </header>

      {/* PDF viewer */}
      <section className="clay-lg bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-extrabold flex items-center gap-2"><FileText className="w-4 h-4 text-primary"/>PDF Viewer</h2>
            {feedback === 'rejected' ? (
              <p className="text-xs text-amber-500 mt-0.5 font-bold flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Showing full {subjectName} textbook
              </p>
            ) : data?.matchedChapter && data.matchedChapter !== title ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Closest match: <span className="font-bold text-foreground">{data.matchedChapter}</span>
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {/* Confirm / Reject feedback — only shown when PDF loaded and not yet decided */}
            {!isLoading && !error && data?.proxyUrl && feedback === 'idle' && (
              <>
                <button
                  onClick={handleConfirm}
                  title="This is the correct PDF for this chapter"
                  className="h-9 px-3 rounded-xl clay-sm bg-card flex items-center gap-1.5 text-xs font-bold text-emerald-500 hover:scale-105 active:scale-95 transition-transform"
                >
                  <ThumbsUp className="w-4 h-4" /> Correct
                </button>
                <button
                  onClick={handleReject}
                  title="Wrong PDF — show the full subject textbook instead"
                  className="h-9 px-3 rounded-xl clay-sm bg-card flex items-center gap-1.5 text-xs font-bold text-destructive hover:scale-105 active:scale-95 transition-transform"
                >
                  <ThumbsDown className="w-4 h-4" /> Wrong
                </button>
              </>
            )}
            {feedback === 'confirming' || feedback === 'rejecting' ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : null}
            {feedback === 'confirmed' && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                <CheckCircle2 className="w-4 h-4" /> Saved!
              </span>
            )}
          </div>
        </div>
        <div className="aspect-[4/5] sm:aspect-[16/10] rounded-2xl clay-pressed bg-gradient-to-br from-muted to-card flex items-center justify-center relative overflow-hidden">
          {isLoading && <Loader2 className="w-8 h-8 animate-spin text-primary"/>}
          {error && <div className="text-destructive font-bold p-4 text-center">{(error as Error).message}</div>}
          {!isLoading && !error && activePdfUrl && (
            <iframe
              key={activePdfUrl}
              src={activePdfUrl}
              className="w-full h-full border-0"
              title={feedback === 'rejected' ? `${subjectName} Textbook` : (data?.matchedChapter || title)}
            />
          )}
          {!isLoading && !error && !activePdfUrl && (
            <div className="text-muted-foreground font-bold p-4 text-center">PDF not available for this chapter.</div>
          )}
        </div>
      </section>

      {/* Concept graph */}
      <section className="clay-lg bg-card p-6">
        <h2 className="font-extrabold mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary"/> Related concepts</h2>
        <ConceptGraph center={title} subjectName={subjectName} std={std} />
      </section>

      {/* Resources */}
      <section className="grid md:grid-cols-2 gap-4">
        <div className="clay-lg bg-card p-6 space-y-3">
          <h3 className="font-extrabold">Suggested resources</h3>
          {[
            { id: "shaalaa", icon: ExternalLink, label: "Shaalaa.com — solved examples", color: "gradient-cyan text-white", disabled: false },
            { id: "yt", icon: Youtube, label: "Linear equations explained (8 min)", color: "gradient-peach text-orange-900", disabled: false },
            { id: "notes", icon: NotebookPen, label: "AI revision notes", color: "gradient-yellow text-amber-900", disabled: true },
            { id: "worksheet", icon: FileText, label: "Practice worksheet (PDF)", color: "gradient-mint text-emerald-900", disabled: true },
          ].map((r) => (
            <button 
              key={r.label} 
              onClick={() => { if (!r.disabled) setSelectedResource(r.id as any); }}
              className="flex items-center w-full text-left gap-3 clay-sm bg-card p-3 hover:-translate-y-0.5 transition-transform"
            >
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", r.color, r.disabled && "opacity-50")}>
                <r.icon className="w-5 h-5"/>
              </div>
              <span className={cn("font-bold flex-1", r.disabled && "opacity-50")}>{r.label}</span>
              {!r.disabled && <ExternalLink className="w-4 h-4 text-muted-foreground"/>}
            </button>
          ))}
        </div>
        <div className="clay-lg gradient-primary text-white p-6 space-y-4 relative overflow-hidden">
          <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full bg-white/20 blur-2xl"/>
          <h3 className="font-extrabold relative">Learning insights</h3>
          <div className="grid grid-cols-2 gap-3 relative">
            <Insight icon={Clock} label="Time spent" value="42 min"/>
            <Insight icon={TrendingUp} label="Mastery" value="78%"/>
            <Insight icon={AlertTriangle} label="Weak topic" value="Word problems"/>
            <Insight icon={Sparkles} label="Streak" value="4 days"/>
          </div>
        </div>
      </section>

      {/* Zoom-in Modal for Resources */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedResource(null)} />
          <div className="relative w-full max-w-lg clay-lg bg-card p-6 z-10 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {selectedResource === 'shaalaa' ? <><ExternalLink className="w-5 h-5 text-cyan-500"/> Shaalaa.com Links</> : <><Youtube className="w-5 h-5 text-red-500"/> YouTube Lectures</>}
              </h2>
              <button onClick={() => setSelectedResource(null)} className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>

            {isResourceLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 animate-spin text-primary"/></div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {(() => {
                  const rows =
                    selectedResource === "shaalaa"
                      ? ((resourceData?.links as string[] | undefined) ?? []).map((href) => ({
                          href,
                          label: href,
                        }))
                      : ((resourceData?.videos as (string | { url?: string; title?: string })[] | undefined) ?? []).map(
                          (v) => ({
                            href: typeof v === "string" ? v : v?.url ?? "",
                            label: typeof v === "string" ? v : v?.title ?? v?.url ?? "",
                          })
                        );
                  const filtered = rows.filter((row) => row.href);
                  return (
                    <>
                      {filtered.map((row, idx: number) => (
                        <a
                          key={idx}
                          href={row.href}
                          target="_blank"
                          rel="noreferrer"
                          className="block p-4 clay-sm bg-muted/50 rounded-xl hover:bg-muted hover:-translate-y-0.5 transition-all font-medium break-all text-primary hover:underline"
                        >
                          {row.label}
                        </a>
                      ))}
                      {!filtered.length ? (
                        <p className="text-muted-foreground text-center py-8 font-medium">
                          No resources found for this chapter.
                        </p>
                      ) : null}
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
      <Icon className="w-4 h-4 mb-2 opacity-90"/>
      <div className="text-xs opacity-90 font-bold">{label}</div>
      <div className="font-black">{value}</div>
    </div>
  );
}

function ConceptGraph({ center, subjectName, std }: { center: string; subjectName: string; std: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["related-concepts", std, subjectName, center],
    queryFn: async () => {
      const res = await fetch(apiPath(`/api/content/related?std=${std}&subjectName=${encodeURIComponent(subjectName)}&chapterName=${encodeURIComponent(center)}`));
      const body = await parseApiJson<{ concepts?: { name: string; x: number; y: number; color: string }[] }>(res);
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
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            {nodes.map((n) => (
              <line key={n.name} x1="50" y1="50" x2={n.x} y2={n.y} stroke="oklch(0.85 0.05 280)" strokeWidth="0.4" strokeDasharray="1 1" />
            ))}
          </svg>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-5 py-3 rounded-2xl gradient-primary text-white font-extrabold clay-sm glow-purple text-center max-w-[40%] leading-tight">
            {center}
          </div>
          {nodes.map((n) => (
            <div
              key={n.name}
              className={cn("absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1.5 rounded-xl font-bold text-xs clay-sm leading-tight text-center max-w-[28%]", n.color)}
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
