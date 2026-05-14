import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Loader2, ChevronDown, ChevronRight, BookOpen, User, School, CheckCircle2, XCircle, Search } from "lucide-react";
import { apiPath, parseApiJson } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { ClayButton } from "@/components/ClayButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/student-progress")({
  head: () => ({ meta: [{ title: "Student Progress — Nova Learn" }] }),
  component: StudentProgressPage,
});

type ChapterAttempt = {
  chapter: string;
  subject: string;
  score: number;
  total: number;
  submittedAt: string;
};

type StudentProgress = {
  email: string;
  name: string;
  std: string;
  chaptersDone: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  chapters: ChapterAttempt[];
};

type ProgressResponse = {
  students: StudentProgress[];
};

function StudentProgressPage() {
  const { data: user, isLoading: meLoading } = useMe();
  const isTeacher = user?.role === "teacher";
  const [expanded, setExpanded] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["teacher-student-progress", subjectFilter],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const params = subjectFilter ? `?subject=${encodeURIComponent(subjectFilter)}` : "";
      const res = await fetch(apiPath(`/api/teacher/students/progress${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await parseApiJson<ProgressResponse & { error?: string }>(res);
      if (!res.ok) throw new Error(body.error || "Failed");
      return body.students;
    },
    enabled: !!user && isTeacher,
  });

  if (meLoading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isTeacher) {
    return (
      <div className="p-10 max-w-md mx-auto text-center space-y-4">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground" />
        <p className="font-bold">Only teachers can view student progress.</p>
        <Link to="/app">
          <ClayButton variant="white">Back to Home</ClayButton>
        </Link>
      </div>
    );
  }

  const allSubjects = [...new Set((data || []).flatMap((s) => s.chapters.map((c) => c.subject)))];

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" /> Student Chapter Progress
          </h1>
          <p className="text-muted-foreground mt-1 font-bold">
            See which chapters each student has completed and their quiz scores.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="clay-pressed bg-card rounded-xl px-3 h-10 flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="bg-transparent outline-none font-bold text-sm"
          >
            <option value="">All subjects</option>
            {allSubjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {data && (
          <span className="text-sm font-bold text-muted-foreground">
            {data.length} student{data.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <p className="text-destructive font-bold text-center">Could not load student progress.</p>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="clay-lg bg-card p-10 text-center space-y-3">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="font-bold">No chapter quiz data yet.</p>
          <p className="text-sm text-muted-foreground font-medium">
            Students need to take chapter quizzes for their progress to appear here.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {(data || []).map((student) => {
          const isOpen = expanded === student.email;
          return (
            <div key={student.email} className="clay-lg bg-card overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : student.email)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 clay-sm">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold truncate">{student.name}</div>
                  <div className="text-xs text-muted-foreground font-bold truncate">{student.email}</div>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-sm">
                  {student.std && (
                    <span className="flex items-center gap-1 font-bold text-muted-foreground">
                      <School className="w-3.5 h-3.5" /> Grade {student.std}
                    </span>
                  )}
                  <span className="font-bold text-muted-foreground">
                    {student.chaptersDone} chapter{student.chaptersDone !== 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-2 w-20 rounded-full bg-muted overflow-hidden",
                    )}>
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          student.percentage >= 70 ? "bg-emerald-500" : student.percentage >= 40 ? "bg-amber-500" : "bg-rose-500",
                        )}
                        style={{ width: `${Math.min(student.percentage, 100)}%` }}
                      />
                    </div>
                    <span className={cn(
                      "font-black text-sm w-10 text-right",
                      student.percentage >= 70 ? "text-emerald-500" : student.percentage >= 40 ? "text-amber-500" : "text-rose-500",
                    )}>
                      {student.percentage}%
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-muted-foreground">
                  {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-muted/50 p-4 space-y-2">
                  {/* Mobile summary */}
                  <div className="flex sm:hidden items-center gap-4 text-sm mb-3 pb-3 border-b border-muted/30">
                    {student.std && (
                      <span className="flex items-center gap-1 font-bold text-muted-foreground">
                        <School className="w-3.5 h-3.5" /> Grade {student.std}
                      </span>
                    )}
                    <span className="font-bold text-muted-foreground">
                      {student.chaptersDone} chapters
                    </span>
                    <span className={cn(
                      "font-black",
                      student.percentage >= 70 ? "text-emerald-500" : student.percentage >= 40 ? "text-amber-500" : "text-rose-500",
                    )}>
                      {student.percentage}%
                    </span>
                  </div>

                  {student.chapters.length === 0 ? (
                    <p className="text-sm text-muted-foreground font-medium text-center py-4">No chapter data for this filter.</p>
                  ) : (
                    <div className="grid gap-2">
                      {student.chapters.map((ch) => {
                        const pct = ch.total > 0 ? Math.round((ch.score / ch.total) * 100) : 0;
                        return (
                          <div
                            key={ch.chapter}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/30 transition-colors"
                          >
                            <div className={cn(
                              "shrink-0",
                              pct >= 70 ? "text-emerald-500" : pct >= 40 ? "text-amber-500" : "text-rose-500",
                            )}>
                              {pct >= 70 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm truncate">{ch.chapter}</div>
                              <div className="text-[10px] text-muted-foreground font-medium">{ch.subject}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={cn(
                                "font-black text-sm",
                                pct >= 70 ? "text-emerald-500" : pct >= 40 ? "text-amber-500" : "text-rose-500",
                              )}>
                                {ch.score}/{ch.total}
                              </span>
                              <div className="text-[10px] text-muted-foreground font-medium">{pct}%</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
