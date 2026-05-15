import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, CalendarDays } from "lucide-react";
import { ClayButton } from "@/components/ClayButton";
import { ClayInput } from "@/components/ClayInput";
import { apiPath, parseApiJson } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/quizzes/new")({
  head: () => ({ meta: [{ title: "New quiz — Nova Learn" }] }),
  component: NewQuizPage,
});

type QDraft = { q: string; options: string[]; correct: number };

function NewQuizPage() {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMe();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [deadline, setDeadline] = useState("");
  const [targetGrade, setTargetGrade] = useState<number | null>(null);
  const [targetBoard, setTargetBoard] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QDraft[]>([
    { q: "", options: ["", "", "", ""], correct: 0 },
  ]);

  const save = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("token");
      const iso = new Date(deadline).toISOString();
      const res = await fetch(apiPath("/api/teacher/quizzes"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          subject,
          deadline: iso,
          questions,
          targetGrade,
          targetBoard,
        }),
      });
      const data = await parseApiJson<{ error?: string; quiz?: { quizId: string } }>(res);
      if (!res.ok) throw new Error(data.error || "Save failed");
      return data.quiz!;
    },
    onSuccess: () => {
      navigate({ to: "/app/quizzes" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== "teacher") {
    return (
      <div className="p-10 max-w-lg mx-auto text-center space-y-4">
        <p className="font-bold">Only teachers can create quizzes.</p>
        <ClayButton variant="white" onClick={() => navigate({ to: "/app/quizzes" })}>
          Back to quizzes
        </ClayButton>
      </div>
    );
  }

  const updateQ = (i: number, patch: Partial<QDraft>) => {
    setQuestions((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  };

  const updateOpt = (qi: number, oi: number, val: string) => {
    setQuestions((prev) =>
      prev.map((row, j) => {
        if (j !== qi) return row;
        const options = row.options.map((o, k) => (k === oi ? val : o));
        return { ...row, options };
      }),
    );
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6 pb-24">
      <header>
        <h1 className="text-3xl font-black">New quiz</h1>
        <p className="text-muted-foreground mt-1">
          Title, subject, which class should get notified, deadline, then questions.
        </p>
      </header>

      <div className="clay-lg bg-card p-6 space-y-4">
        <ClayInput label="Quiz title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 5 — Fractions check-in" />
        <ClayInput label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" />
        <div>
          <label className="text-sm font-bold text-foreground/80 ml-2">Students to notify (class & board)</label>
          <p className="text-xs text-muted-foreground ml-2 mt-1 mb-2">
            Only students with this grade and board see the quiz in notifications and schedule.
          </p>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setTargetGrade(g)}
                className={cn(
                  "h-12 rounded-2xl font-bold transition-all",
                  targetGrade === g ? "gradient-primary text-white glow-purple" : "clay-sm bg-card hover:-translate-y-0.5",
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {["CBSE", "ICSE", "IB", "State Board"].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setTargetBoard(b)}
                className={cn(
                  "h-12 rounded-2xl font-bold transition-all text-sm",
                  targetBoard === b ? "gradient-cyan text-white" : "clay-sm bg-card hover:-translate-y-0.5",
                )}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-bold text-foreground/80 ml-2">Deadline</label>
          <div className="mt-2 clay-pressed bg-card rounded-2xl px-4 h-12 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="datetime-local"
              className="bg-transparent outline-none flex-1 font-bold text-sm [color-scheme:light] dark:[color-scheme:dark]"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>
      </div>

      {questions.map((row, qi) => (
        <div key={qi} className="clay-lg bg-card p-6 space-y-4 relative">
          {questions.length > 1 && (
            <button
              type="button"
              className="absolute top-4 right-4 p-2 rounded-xl text-destructive hover:bg-destructive/10"
              onClick={() => setQuestions((p) => p.filter((_, j) => j !== qi))}
              aria-label="Remove question"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <div className="text-sm font-black text-primary">Question {qi + 1}</div>
          <ClayInput label="Question text" value={row.q} onChange={(e) => updateQ(qi, { q: e.target.value })} placeholder="Ask something clear and short" />
          <div className="space-y-2">
            <div className="text-xs font-bold text-muted-foreground ml-2">Options (mark the correct one)</div>
            {row.options.map((opt, oi) => (
              <div key={oi} className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => updateQ(qi, { correct: oi })}
                  className={cn(
                    "h-10 w-10 rounded-xl font-black shrink-0 clay-sm",
                    row.correct === oi ? "gradient-primary text-white" : "bg-muted",
                  )}
                >
                  {String.fromCharCode(65 + oi)}
                </button>
                <input
                  className="flex-1 h-11 rounded-2xl border-2 border-muted bg-background px-4 text-sm font-bold"
                  value={opt}
                  onChange={(e) => updateOpt(qi, oi, e.target.value)}
                  placeholder={`Option ${oi + 1}`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <ClayButton
        type="button"
        variant="white"
        className="w-full"
        onClick={() => setQuestions((p) => [...p, { q: "", options: ["", "", "", ""], correct: 0 }])}
      >
        <Plus className="w-4 h-4" /> Add question
      </ClayButton>

      {save.isError && <p className="text-destructive font-bold text-sm">{(save.error as Error).message}</p>}

      <div className="flex gap-3">
        <ClayButton variant="white" className="flex-1" onClick={() => navigate({ to: "/app/quizzes" })}>
          Cancel
        </ClayButton>
        <ClayButton
          className="flex-1"
          disabled={save.isPending || !title.trim() || !subject.trim() || !deadline || targetGrade == null || !targetBoard}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish quiz"}
        </ClayButton>
      </div>
    </div>
  );
}
