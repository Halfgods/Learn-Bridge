import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trophy, Clock, ArrowRight, Loader2, BarChart3, Medal, Sparkles, Brain, BookOpen } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { apiPath, parseApiJson } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { ClayButton } from "@/components/ClayButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/quizzes/")({
  head: () => ({ meta: [{ title: "Quizzes — Nova Learn" }] }),
  component: QuizzesHome,
});

type QuizRow = {
  quizId: string;
  title: string;
  subject: string;
  deadline: string;
  teacherName?: string;
  questionCount?: number;
  completed?: boolean;
  score?: number | null;
  total?: number | null;
};

type Achievements = {
  totalQuizzes: number;
  averageScore: number;
  bestScore: number;
  bestTotal: number;
  totalScore: number;
  maxScore: number;
  subjects: string[];
  recent: { quizId: string; title: string; score: number; total: number; submittedAt: string }[];
};

function QuizzesHome() {
  const navigate = useNavigate();
  const { data: user, isLoading: meLoading } = useMe();
  const isTeacher = user?.role === "teacher";

  const teacherQ = useQuery({
    queryKey: ["teacher-quizzes"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath("/api/teacher/quizzes"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiJson<{ quizzes: QuizRow[] }>(res);
      if (!res.ok) throw new Error("Failed");
      return data.quizzes;
    },
    enabled: !!user && isTeacher,
  });

  const studentQ = useQuery({
    queryKey: ["student-quiz-assignments"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath("/api/student/quiz-assignments"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiJson<{ assignments: QuizRow[]; pendingCount?: number }>(res);
      if (!res.ok) throw new Error("Failed");
      return data.assignments;
    },
    enabled: !!user && !isTeacher,
  });

  const achievementsQ = useQuery({
    queryKey: ["student-achievements"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath("/api/student/achievements"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return parseApiJson<Achievements>(res);
    },
    enabled: !!user && !isTeacher,
  });

  if (meLoading || !user) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const rows = isTeacher ? teacherQ.data : studentQ.data;
  const pending = isTeacher ? teacherQ.isLoading : studentQ.isLoading;
  const err = isTeacher ? teacherQ.error : studentQ.error;

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Quizzes</h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher
              ? "Build quick checks for your class — like a simple form, with a clear deadline."
              : "Quizzes from teachers for your class appear here."}
          </p>
        </div>
        {isTeacher && (
          <ClayButton size="lg" onClick={() => navigate({ to: "/app/quizzes/new" })} className="shrink-0">
            <Plus className="w-4 h-4" /> New quiz
          </ClayButton>
        )}
      </div>

      {/* Student achievements */}
      {!isTeacher && achievementsQ.data && achievementsQ.data.totalQuizzes > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Trophy, label: "Completed", value: achievementsQ.data.totalQuizzes, color: "text-clay-yellow" },
            { icon: Brain, label: "Avg Score", value: `${achievementsQ.data.averageScore}%`, color: "text-cyan-400" },
            { icon: Medal, label: "Best", value: `${achievementsQ.data.bestScore}/${achievementsQ.data.bestTotal}`, color: "text-emerald-400" },
            { icon: BookOpen, label: "Subjects", value: achievementsQ.data.subjects.length, color: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="clay-lg bg-card p-4 text-center space-y-1">
              <s.icon className={cn("w-5 h-5 mx-auto", s.color)} />
              <div className="text-2xl font-black">{s.value}</div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </section>
      )}

      {pending && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      )}
      {err && <p className="text-destructive font-bold text-center">Could not load quizzes.</p>}

      {!pending && rows && rows.length === 0 && (
        <div className="clay-lg bg-card p-10 text-center space-y-3">
          <Trophy className="w-12 h-12 mx-auto text-clay-yellow" />
          <p className="font-bold">{isTeacher ? "No quizzes yet — create your first one!" : "No quizzes for your class yet."}</p>
          {isTeacher && <ClayButton onClick={() => navigate({ to: "/app/quizzes/new" })}>Create quiz</ClayButton>}
        </div>
      )}

      <ul className="space-y-3">
        {(rows || []).map((q) => {
          let closed = false;
          try {
            closed = isPast(parseISO(q.deadline));
          } catch {
            closed = false;
          }
          return (
            <li key={q.quizId} className="space-y-2">
              <Link
                to="/app/quizzes/$quizId"
                params={{ quizId: q.quizId }}
                className="clay-lg bg-card p-5 flex flex-wrap items-center gap-4 hover:-translate-y-0.5 transition-all group"
              >
                <div className="h-12 w-12 rounded-2xl gradient-primary clay-sm flex items-center justify-center text-white shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="font-extrabold text-lg flex flex-wrap items-center gap-2">
                    {q.title}
                    {!isTeacher && q.completed && (
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        Done {q.score != null && q.total != null ? `· ${q.score}/${q.total}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground font-bold">
                    {q.subject}
                    {q.teacherName ? ` · ${q.teacherName}` : ""}
                    {typeof q.questionCount === "number" ? ` · ${q.questionCount} questions` : ""}
                  </div>
                </div>
                <div
                  className={cn(
                    "text-sm font-bold flex items-center gap-2",
                    closed ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  <Clock className="w-4 h-4" />
                  {closed ? "Closed · " : "Due "}
                  {q.deadline ? format(parseISO(q.deadline), "MMM d, h:mm a") : "—"}
                </div>
                <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
              </Link>
              {isTeacher && (
                <div className="pl-4">
                  <Link
                    to="/app/quizzes/$quizId/results"
                    params={{ quizId: q.quizId }}
                    className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                  >
                    <BarChart3 className="w-4 h-4" /> View class results
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
