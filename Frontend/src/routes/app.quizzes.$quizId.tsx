import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { apiPath, parseApiJson } from "@/lib/api";
import { ClayButton } from "@/components/ClayButton";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/useMe";

export const Route = createFileRoute("/app/quizzes/$quizId")({
  head: () => ({ meta: [{ title: "Quiz — Nova Learn" }] }),
  component: TakeQuizPage,
});

type Q = { q: string; options: string[] };

type QuizPayload = {
  quiz: { title: string; subject: string; deadline: string; questions: Q[] };
  myAttempt?: { score: number; total: number; submittedAt?: string } | null;
};

function TakeQuizPage() {
  const { quizId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["quiz-take", quizId],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(apiPath(`/api/quizzes/${quizId}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Not found");
      return parseApiJson<QuizPayload>(res);
    },
  });

  useEffect(() => {
    const att = data?.myAttempt;
    if (att && me?.role === "student") {
      setDone(true);
      setResult({ score: att.score, total: att.total });
    }
  }, [data?.myAttempt, me?.role]);

  const submitMut = useMutation({
    mutationFn: async (finalAnswers: number[]) => {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Log in to submit your quiz.");
      const res = await fetch(apiPath(`/api/quizzes/${quizId}/submit`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const body = await parseApiJson<{ score: number; total: number; error?: string; alreadyCompleted?: boolean }>(res);
      if (!res.ok) throw new Error(body.error || "Submit failed");
      return body;
    },
    onSuccess: (body) => {
      queryClient.invalidateQueries({ queryKey: ["student-quiz-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["quiz-take", quizId] });
      setResult({ score: body.score, total: body.total });
      setDone(true);
    },
  });

  if (isLoading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.quiz) {
    return (
      <div className="p-10 max-w-md mx-auto text-center space-y-4">
        <p className="font-bold text-destructive">Quiz not found.</p>
        <Link to="/app/quizzes">
          <ClayButton variant="white">Back</ClayButton>
        </Link>
      </div>
    );
  }

  const quiz = data.quiz;
  const qs = quiz.questions || [];
  let closed = false;
  try {
    closed = isPast(parseISO(quiz.deadline));
  } catch {
    closed = false;
  }

  if (done && result) {
    navigate({ to: "/app" });
    return null;
  }

  const cur = qs[idx];
  const progress = qs.length ? (idx / qs.length) * 100 : 0;

  const next = () => {
    if (picked === null) return;
    const nextAnswers = [...answers, picked];
    setAnswers(nextAnswers);
    setPicked(null);
    if (idx < qs.length - 1) {
      setIdx(idx + 1);
    } else {
      submitMut.mutate(nextAnswers);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-6">
      <Link to="/app/quizzes" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> All quizzes
      </Link>

      <div className="clay-lg bg-card p-6 space-y-2">
        <div className="text-xs font-bold text-primary">{quiz.subject}</div>
        <h1 className="text-2xl font-black">{quiz.title}</h1>
        <p className="text-sm text-muted-foreground font-bold">
          Due {format(parseISO(quiz.deadline), "MMM d, yyyy h:mm a")}
          {closed && <span className="text-destructive"> · deadline passed (practice mode)</span>}
        </p>
      </div>

      {qs.length === 0 ? (
        <p className="text-center font-bold text-muted-foreground">This quiz has no questions.</p>
      ) : (
        <>
          <div className="clay-sm bg-card h-3 rounded-full overflow-hidden">
            <div className="h-full gradient-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="clay-lg bg-card p-8 space-y-6">
            <p className="text-sm font-bold text-muted-foreground">
              Question {idx + 1} of {qs.length}
            </p>
            <h2 className="text-xl font-black leading-snug">{cur.q}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {cur.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPicked(i)}
                  className={cn(
                    "min-h-14 rounded-2xl font-bold text-left px-5 py-3 transition-all",
                    picked === i ? "gradient-primary text-white glow-purple scale-[1.02]" : "clay-sm bg-card hover:-translate-y-0.5",
                  )}
                >
                  <span className="opacity-70 mr-2">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              ))}
            </div>
            <ClayButton size="lg" className="w-full" disabled={picked === null || submitMut.isPending} onClick={next}>
              {submitMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : idx < qs.length - 1 ? (
                <>
                  Next <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                "Submit"
              )}
            </ClayButton>
          </div>
        </>
      )}
    </div>
  );
}
