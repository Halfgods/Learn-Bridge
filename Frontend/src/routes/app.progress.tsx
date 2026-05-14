import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Loader2, Brain } from "lucide-react";
import { apiPath, parseApiJson } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/progress")({
  head: () => ({ meta: [{ title: "Progress \u2014 Nova Learn" }] }),
  component: ProgressPage,
});

type ProgressEntry = {
  chapterName: string;
  subjectName: string;
  quizScore: number;
  totalQuestions: number;
  isCompleted: boolean;
};

type CurriculumSubject = {
  subjectName: string;
  chapters: { chapterName: string }[];
};

type SubjectStat = {
  name: string;
  completed: number;
  total: number;
  avg: number;
  attempted: ProgressEntry[];
  allChapters: { chapterName: string }[];
};

const BAR_COLORS = ["#FB7185", "#A2D2FF", "#FBBF24", "#1F2937"];

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="clay-sm bg-card p-3 font-black">
        <p className="uppercase text-xs text-muted-foreground">{label}</p>
        <p className="text-3xl">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
}

function ProgressPage() {
  const { data: user } = useMe();
  const fullName = user?.name || "Scholar";
  const std = user?.grade || 10;
  const board = user?.board || "CBSE";

  const progressQ = useQuery({
    queryKey: ["progress"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath("/api/progress"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiJson<ProgressEntry[]>(res);
      return Array.isArray(data) ? data : [];
    },
  });

  const curriculumQ = useQuery({
    queryKey: ["curriculum", std, board],
    queryFn: async () => {
      const res = await fetch(apiPath(`/api/curriculum?std=${std}&board=${board}`));
      const data = await parseApiJson<CurriculumSubject[]>(res);
      return Array.isArray(data) ? data : [];
    },
  });

  const progress = progressQ.data ?? [];
  const curriculum = curriculumQ.data ?? [];

  const progressBySubject = progress.reduce(
    (acc, p) => {
      if (!acc[p.subjectName]) acc[p.subjectName] = [];
      acc[p.subjectName].push(p);
      return acc;
    },
    {} as Record<string, ProgressEntry[]>,
  );

  const subjectStats: SubjectStat[] = curriculum.map((subj) => {
    const attempted = progressBySubject[subj.subjectName] || [];
    const uniqueCompleted = new Set(attempted.filter((p) => p.isCompleted).map((p) => p.chapterName));
    const completed = uniqueCompleted.size;
    const totalChapters = subj.chapters.length;
    const avg =
      attempted.length > 0
        ? Math.round(
            attempted.reduce(
              (s, p) => s + (p.totalQuestions > 0 ? (p.quizScore / p.totalQuestions) * 100 : 0),
              0,
            ) / attempted.length,
          )
        : 0;
    return { name: subj.subjectName, completed, total: totalChapters, avg, attempted, allChapters: subj.chapters };
  });

  const validScores = progress.filter((p) => p.totalQuestions > 0);
  let insight = "No quiz results yet. Complete a quiz to see your insights here!";
  if (validScores.length > 0) {
    const best = validScores.reduce((a, b) =>
      a.quizScore / a.totalQuestions > b.quizScore / b.totalQuestions ? a : b,
    );
    const pct = Math.round((best.quizScore / best.totalQuestions) * 100);
    insight = `Great work! Your best score is in "${best.chapterName}" (${best.subjectName}) \u2014 ${pct}%. Focus on pending chapters to climb the leaderboard!`;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1 flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-clay-purple" /> Progress Insights
        </h1>
        <p className="text-sm text-muted-foreground font-bold">
          {fullName}&rsquo;s Journey
        </p>
      </header>

      <div className="clay-lg gradient-primary text-white p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/20 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm font-bold opacity-90 mb-1">
            <Brain className="w-4 h-4" /> AI Performance Insight
          </div>
          <p className="text-lg md:text-xl font-bold opacity-80">{insight}</p>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-extrabold mb-4">Chapters Completed</h2>
        {progressQ.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : progressQ.error ? (
          <div className="clay-lg bg-card p-8 font-bold text-destructive text-center">
            Could not load progress. Ensure you are logged in and the backend is running.
          </div>
        ) : subjectStats.length === 0 ? (
          <div className="clay-lg bg-card p-8 font-bold text-muted-foreground text-center">
            No progress data yet \u2014 take a quiz!
          </div>
        ) : (
          <div className="space-y-4">
            {subjectStats.map((subj) => {
              const pct = subj.total > 0 ? Math.round((subj.completed / subj.total) * 100) : 0;
              return (
                <div key={subj.name} className="clay-lg bg-card p-5 hover:-translate-y-0.5 transition-transform">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h3 className="font-extrabold text-xl">{subj.name}</h3>
                      <p className="font-bold text-xs text-muted-foreground">
                        {subj.completed} of {subj.total} chapters completed
                      </p>
                    </div>
                    <span className="text-2xl font-black">{pct}%</span>
                  </div>
                  <div className="h-4 rounded-full clay-pressed bg-muted w-full mb-4">
                    <div
                      className="h-full rounded-full gradient-primary transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {subj.allChapters.map((ch, i) => {
                      const entry = subj.attempted.find((a) => a.chapterName === ch.chapterName);
                      return (
                        <span
                          key={i}
                          className={cn(
                            "text-xs font-bold px-3 py-1 rounded-2xl border transition-all",
                            entry
                              ? entry.isCompleted
                                ? "gradient-yellow text-amber-900 border-transparent"
                                : "bg-muted text-muted-foreground border-border"
                              : "bg-transparent text-muted-foreground border-border",
                          )}
                        >
                          {entry ? (entry.isCompleted ? "\u2705" : "\u23F3") : "\u25CB"}{" "}
                          {ch.chapterName}
                          {entry ? ` (${entry.quizScore}/${entry.totalQuestions})` : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-extrabold mb-4">Avg Quiz Score per Subject</h2>
        {subjectStats.length === 0 ? (
          <div className="clay-lg bg-card p-10 font-bold text-muted-foreground text-center">
            No scores yet \u2014 complete a quiz!
          </div>
        ) : (
          <div className="clay-lg bg-card p-4 md:p-6" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectStats} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontWeight: 900, fontSize: 13, fontFamily: "inherit", fill: "var(--foreground)" }}
                  axisLine={{ stroke: "var(--foreground)", strokeWidth: 2 }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontWeight: 700, fontSize: 12, fontFamily: "inherit", fill: "var(--foreground)" }}
                  axisLine={{ stroke: "var(--foreground)", strokeWidth: 2 }}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="avg" radius={[8, 8, 0, 0]} strokeWidth={2} stroke="var(--foreground)" maxBarSize={72}>
                  {subjectStats.map((_, idx) => (
                    <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
