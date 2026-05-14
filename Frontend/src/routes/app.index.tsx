import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  Calculator,
  Beaker,
  BookOpen,
  Globe2,
  Cpu,
  Languages,
  Flame,
  Bell,
  ArrowRight,
  Trophy,
  Clock,
  Search,
  X,
  GraduationCap,
  KeyRound,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { apiPath, parseApiJson } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { ClayButton } from "@/components/ClayButton";
import { ClayInput } from "@/components/ClayInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Nova Learn" }] }),
  component: Dashboard,
});

type SubjectCardMeta = {
  icon: typeof BookOpen;
  gradient: string;
  text: string;
  progress: number;
  lessons: number;
};

const subjectMeta: Record<string, SubjectCardMeta> = {
  Mathematics: { icon: Calculator, gradient: "gradient-primary", text: "text-white", progress: 68, lessons: 24 },
  Science: { icon: Beaker, gradient: "gradient-cyan", text: "text-white", progress: 42, lessons: 18 },
  English: { icon: BookOpen, gradient: "gradient-yellow", text: "text-amber-900", progress: 81, lessons: 15 },
  "Social Science": { icon: Globe2, gradient: "gradient-peach", text: "text-orange-900", progress: 35, lessons: 20 },
  Computer: { icon: Cpu, gradient: "gradient-mint", text: "text-emerald-900", progress: 56, lessons: 12 },
  Languages: { icon: Languages, gradient: "gradient-primary", text: "text-white", progress: 22, lessons: 16 },
  "Environmental Studies": { icon: Globe2, gradient: "gradient-mint", text: "text-emerald-900", progress: 40, lessons: 14 },
};

const fallbackSubjects = [
  { id: "math", name: "Mathematics", icon: Calculator, gradient: "gradient-primary", text: "text-white", progress: 68, lessons: 24 },
  { id: "science", name: "Science", icon: Beaker, gradient: "gradient-cyan", text: "text-white", progress: 42, lessons: 18 },
  { id: "english", name: "English", icon: BookOpen, gradient: "gradient-yellow", text: "text-amber-900", progress: 81, lessons: 15 },
  { id: "social", name: "Social Science", icon: Globe2, gradient: "gradient-peach", text: "text-orange-900", progress: 35, lessons: 20 },
];

type Assignment = {
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

const scheduleColors = ["gradient-cyan text-white", "gradient-yellow text-amber-900", "gradient-peach text-orange-900", "gradient-mint text-emerald-900"];

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [teacherDialog, setTeacherDialog] = useState(false);
  const [teacherCode, setTeacherCode] = useState("");
  const [teacherErr, setTeacherErr] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("dismissed-notifs") || "[]"); } catch { return []; }
  });

  const dismissNotif = (quizId: string) => {
    const next = [...dismissed, quizId];
    setDismissed(next);
    localStorage.setItem("dismissed-notifs", JSON.stringify(next));
  };

  const todayLabel = format(new Date(), "EEEE, MMMM d");

  const { data: user, isLoading, error } = useMe();

  const gradeForCurriculum = user?.grade ?? (user?.role === "teacher" ? 8 : undefined);

  const { data: dynamicSubjects } = useQuery({
    queryKey: ["subjects", gradeForCurriculum],
    queryFn: async () => {
      const res = await fetch(apiPath(`/api/curriculum/class/${gradeForCurriculum}/subjects`));
      const data = await parseApiJson<{ subjects?: string[] }>(res);
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return data.subjects;
    },
    enabled: gradeForCurriculum != null,
    staleTime: Infinity,
  });

  const isTeacher = user?.role === "teacher";

  const studentAssignmentsQ = useQuery({
    queryKey: ["student-quiz-assignments"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath("/api/student/quiz-assignments"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiJson<{
        assignments: Assignment[];
        pendingCount: number;
      }>(res);
      if (!res.ok) throw new Error("Failed");
      return data;
    },
    enabled: !!user && !isTeacher,
  });

  const teacherQuizzesQ = useQuery({
    queryKey: ["teacher-quizzes"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath("/api/teacher/quizzes"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiJson<{ quizzes: Assignment[] }>(res);
      if (!res.ok) throw new Error("Failed");
      return data.quizzes;
    },
    enabled: !!user && isTeacher,
  });

  const becomeTeacher = useMutation({
    mutationFn: async (code: string) => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath("/api/auth/become-teacher"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Could not verify");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setTeacherDialog(false);
      setTeacherCode("");
      setTeacherErr(null);
    },
    onError: (e: Error) => setTeacherErr(e.message),
  });

  if (error) {
    navigate({ to: "/login" });
    return null;
  }

  const firstName = user?.name ? user.name.split(" ")[0] : "...";

  const subjects =
    dynamicSubjects && dynamicSubjects.length > 0
      ? dynamicSubjects.map((name: string) => {
          const meta = subjectMeta[name] || {
            icon: BookOpen,
            gradient: "gradient-primary",
            text: "text-white",
            progress: 0,
            lessons: 0,
          };
          return {
            id: name.toLowerCase().replace(/\s+/g, "-"),
            name,
            ...meta,
          };
        })
      : fallbackSubjects;

  const pendingCount = !isTeacher ? (studentAssignmentsQ.data?.pendingCount ?? 0) : 0;
  const studentAssignments = studentAssignmentsQ.data?.assignments ?? [];
  const sortedStudentSchedule = [...studentAssignments].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
  );
  const teacherQuizzes = teacherQuizzesQ.data ?? [];
  const sortedTeacherSchedule = [...teacherQuizzes].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
  );
  const pendingNotifications = studentAssignments.filter((a) => !a.completed && !dismissed.includes(a.quizId));

  const allChaptersQ = useQuery({
    queryKey: ["all-chapters", gradeForCurriculum],
    queryFn: async () => {
      const res = await fetch(apiPath(`/api/curriculum/class/${gradeForCurriculum}/all-chapters`));
      const data = await parseApiJson<{ chapters?: { subjectName: string; chapterName: string }[] }>(res);
      if (!res.ok) throw new Error("Failed");
      return data.chapters ?? [];
    },
    enabled: gradeForCurriculum != null,
  });

  function computeLCS(t: string, q: string): number {
    if (!q) return 0;
    const text = t.toLowerCase();
    const query = q.toLowerCase();
    const m = text.length;
    const n = query.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (text[i - 1] === query[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    return dp[m][n];
  }

  const searchResults = searchQuery.trim()
    ? (allChaptersQ.data || []).filter((ch) => computeLCS(ch.chapterName, searchQuery.trim()) === searchQuery.trim().length)
    : [];

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground font-bold">{todayLabel}</p>
          <h1 className="text-3xl lg:text-4xl font-black mt-1">Hi {firstName} 👋</h1>
          <p className="text-muted-foreground">
            {isTeacher ? "Plan quizzes, browse subjects, and check the leaderboard." : "Ready to crush today's goals?"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {!isTeacher && (
            <ClayButton type="button" variant="cyan" size="lg" className="h-12" onClick={() => setTeacherDialog(true)}>
              <KeyRound className="w-4 h-4" /> Teacher access
            </ClayButton>
          )}
          <button type="button" onClick={() => { setSearchOpen(true); setSearchQuery(""); }} className="h-12 w-12 rounded-2xl clay-sm bg-card flex items-center justify-center">
            <Search className="w-5 h-5" />
          </button>
          {!isTeacher && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-12 w-12 rounded-2xl clay-sm bg-card flex items-center justify-center relative"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {pendingNotifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-[10px] font-black text-white flex items-center justify-center">
                      {pendingNotifications.length > 9 ? "9+" : pendingNotifications.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 sm:w-96 clay-lg border-0 p-0 overflow-hidden">
                <div className="p-3 border-b font-black text-sm">New for you</div>
                <div className="max-h-72 overflow-y-auto">
                  {pendingNotifications.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground font-bold">No new quiz alerts.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {pendingNotifications.map((a) => (
                        <li key={a.quizId} className="relative">
                          <Link
                            to="/app/quizzes/$quizId"
                            params={{ quizId: a.quizId }}
                            className="block p-4 pr-16 hover:bg-muted/60 transition-colors"
                          >
                            <div className="font-extrabold text-sm">{a.title}</div>
                            <div className="text-xs text-muted-foreground font-bold mt-1">
                              {a.subject}
                              {a.teacherName ? ` · ${a.teacherName}` : ""}
                            </div>
                            <div className="text-xs font-bold text-primary mt-2">
                              Due {format(parseISO(a.deadline), "MMM d, h:mm a")}
                            </div>
                          </Link>
                          <button
                            onClick={(e) => { e.preventDefault(); dismissNotif(a.quizId); }}
                            className="absolute top-3 right-3 h-7 px-2 rounded-lg text-[10px] font-bold text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                          >
                            Done
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {isTeacher && (
            <button type="button" className="h-12 w-12 rounded-2xl clay-sm bg-card flex items-center justify-center relative opacity-60 cursor-not-allowed" title="Notifications are for students">
              <Bell className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <Dialog open={teacherDialog} onOpenChange={setTeacherDialog}>
        <DialogContent className="sm:rounded-2xl border-0 clay-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Teacher access</DialogTitle>
            <DialogDescription>
              Enter the school-issued teacher code your admin shared. Default demo code:{" "}
              <span className="font-mono font-bold text-foreground">NOVA-TEACHER</span> (set{" "}
              <span className="font-mono">TEACHER_ACCESS_CODE</span> in production).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {teacherErr && <p className="text-sm font-bold text-destructive">{teacherErr}</p>}
            <ClayInput
              label="Access code"
              value={teacherCode}
              onChange={(e) => setTeacherCode(e.target.value)}
              placeholder="Enter code"
              icon={<GraduationCap className="w-4 h-4" />}
            />
            <ClayButton
              type="button"
              className="w-full"
              disabled={becomeTeacher.isPending || !teacherCode.trim()}
              onClick={() => {
                setTeacherErr(null);
                becomeTeacher.mutate(teacherCode.trim());
              }}
            >
              {becomeTeacher.isPending ? "Checking…" : "Unlock teacher tools"}
            </ClayButton>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="clay-lg gradient-primary text-white p-6 md:col-span-2 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/20 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold opacity-90">
                <Flame className="w-4 h-4 text-clay-yellow" /> {isTeacher ? "Engagement" : "Daily streak"}
              </div>
              <div className="text-5xl font-black mt-2">{isTeacher ? "On track" : "7 days"}</div>
              <p className="text-sm opacity-90 mt-1">
                {isTeacher ? "Your quizzes and leaderboard stay in sync with the class." : "Keep it up — finish 1 lesson to extend!"}
              </p>
            </div>
            <div className="text-7xl">{isTeacher ? "📚" : "🔥"}</div>
          </div>
        </div>
        <div className="clay-lg bg-card p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Trophy className="w-4 h-4 text-clay-yellow" /> {isTeacher ? "Class energy" : "XP this week"}
          </div>
          <div className="text-4xl font-black bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-yellow)" }}>
            {isTeacher ? "High" : "1,240"}
          </div>
          <div className="clay-pressed h-2 rounded-full overflow-hidden">
            <div className="h-full gradient-yellow" style={{ width: isTeacher ? "78%" : "62%" }} />
          </div>
          <p className="text-xs text-muted-foreground">{isTeacher ? "Open the leaderboard from the sidebar" : "760 XP to next badge"}</p>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold">{isTeacher ? "Subject library" : "Your subjects"}</h2>
          <Link to="/app/subjects" className="text-sm font-bold text-primary flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {isLoading && !user ? (
          <p className="text-muted-foreground font-bold">Loading your profile…</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((s) => (
              <Link
                key={s.id}
                to="/app/subject/$subjectId"
                params={{ subjectId: s.id }}
                className="clay-lg bg-card p-5 hover:-translate-y-1 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center clay-sm", s.gradient, s.text)}>
                    <s.icon className="w-7 h-7" />
                  </div>
                  <ProgressRing value={s.progress} />
                </div>
                <h3 className="font-extrabold text-lg">{s.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{s.lessons} chapters</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">{isTeacher ? "Open chapters" : `${s.progress}% complete`}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="clay-lg bg-card p-6">
          <h3 className="font-extrabold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> {isTeacher ? "Your schedule" : "Your schedule"}
          </h3>
          {!isTeacher && studentAssignmentsQ.isLoading && (
            <p className="text-sm text-muted-foreground font-bold">Loading quizzes…</p>
          )}
          {!isTeacher && studentAssignmentsQ.error && (
            <p className="text-sm text-destructive font-bold">Could not load your quiz list.</p>
          )}
          {isTeacher && teacherQuizzesQ.isLoading && <p className="text-sm text-muted-foreground font-bold">Loading…</p>}
          <ul className="space-y-3">
            {!isTeacher &&
              sortedStudentSchedule.map((a, i) => {
                const color = scheduleColors[i % scheduleColors.length];
                const hour = format(parseISO(a.deadline), "h:mm a");
                return (
                  <li key={a.quizId}>
                    <Link
                      to="/app/quizzes/$quizId"
                      params={{ quizId: a.quizId }}
                      className="flex items-center gap-3 clay-sm bg-card p-3 rounded-2xl hover:bg-muted/50 transition-colors"
                    >
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", color)}>
                        {a.completed ? <CheckCircle2 className="w-6 h-6" /> : <span className="font-black text-xs">{format(parseISO(a.deadline), "d")}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{a.title}</div>
                        <div className="text-xs text-muted-foreground font-bold">
                          {hour}
                          {a.completed && a.score != null && a.total != null ? ` · Score ${a.score}/${a.total}` : !a.completed ? " · Open quiz" : ""}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            {!isTeacher && sortedStudentSchedule.length === 0 && !studentAssignmentsQ.isLoading && (
              <li className="text-sm text-muted-foreground font-bold">No quizzes assigned for your class yet.</li>
            )}
            {isTeacher &&
              sortedTeacherSchedule.map((a, i) => {
                const color = scheduleColors[i % scheduleColors.length];
                const hour = a.deadline ? format(parseISO(a.deadline), "h:mm a") : "—";
                return (
                  <li key={a.quizId}>
                    <div className="flex items-center gap-3 clay-sm bg-card p-3 rounded-2xl">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs", color)}>
                        {a.deadline ? format(parseISO(a.deadline), "d") : "—"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{a.title}</div>
                        <div className="text-xs text-muted-foreground font-bold">
                          Due {hour}
                          {a.subject ? ` · ${a.subject}` : ""}
                        </div>
                      </div>
                      <Link
                        to="/app/quizzes/$quizId/results"
                        params={{ quizId: a.quizId }}
                        className="text-xs font-bold text-primary shrink-0"
                      >
                        Results
                      </Link>
                    </div>
                  </li>
                );
              })}
            {isTeacher && sortedTeacherSchedule.length === 0 && !teacherQuizzesQ.isLoading && (
              <li className="text-sm text-muted-foreground font-bold">Publish a quiz to see deadlines here.</li>
            )}
          </ul>
        </div>
        <div className="clay-lg gradient-cyan text-white p-6 relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/20 blur-2xl" />
          <h3 className="font-extrabold mb-2">AI recommendation ✨</h3>
          <p className="text-sm opacity-90 mb-4">
            {isTeacher
              ? "Draft a short quiz in Quizzes — students on that grade & board get a notification and see it in their schedule."
              : "Based on yesterday's quiz, spend 15 min on Linear Equations to boost your weak area."}
          </p>
          {isTeacher ? (
            <Link to="/app/quizzes/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-primary font-bold clay-sm">
              Create a quiz <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to="/app/subject/$subjectId"
              params={{ subjectId: "math" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-primary font-bold clay-sm"
            >
              Start now <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </section>

      {/* Search dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:rounded-2xl border-0 clay-lg max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Search chapters</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="clay-pressed bg-card rounded-2xl px-4 h-12 flex items-center gap-3">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                placeholder="Type a chapter name…"
                className="bg-transparent outline-none flex-1 font-bold text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="shrink-0 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {allChaptersQ.isLoading && (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            )}
            {!searchQuery.trim() && (
              <p className="text-sm text-muted-foreground font-bold text-center py-6">Start typing to search chapters across all subjects.</p>
            )}
            {searchQuery.trim() && searchResults.length === 0 && !allChaptersQ.isLoading && (
              <p className="text-sm text-muted-foreground font-bold text-center py-6">No chapters match your search.</p>
            )}
            {searchResults.length > 0 && (
              <ul className="max-h-72 overflow-y-auto space-y-1">
                {searchResults.map((ch) => (
                  <li key={`${ch.subjectName}-${ch.chapterName}`}>
                    <Link
                      to="/app/chapter/$chapterId"
                      params={{ chapterId: encodeURIComponent(ch.chapterName) }}
                      search={{ subjectName: ch.subjectName, std: gradeForCurriculum }}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted transition-colors"
                    >
                      <BookOpen className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <div className="font-extrabold text-sm">{ch.chapterName}</div>
                        <div className="text-xs text-muted-foreground font-bold">{ch.subjectName}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative w-12 h-12">
      <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
        <circle cx="22" cy="22" r={r} stroke="var(--muted)" strokeWidth="5" fill="none" />
        <circle
          cx="22"
          cy="22"
          r={r}
          stroke="url(#g)"
          strokeWidth="5"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="g" x1="0" x2="1">
            <stop offset="0%" stopColor="oklch(0.7 0.18 295)" />
            <stop offset="100%" stopColor="oklch(0.78 0.13 210)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">{value}%</span>
    </div>
  );
}
