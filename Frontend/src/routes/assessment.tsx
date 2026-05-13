import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Timer, Sparkles, ArrowRight, TrendingUp, Award, Target, Loader2 } from "lucide-react";
import { Blobs } from "@/components/Blobs";
import { ClayButton } from "@/components/ClayButton";
import { MascotBadge } from "@/components/MascotBadge";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/assessment")({
  head: () => ({ meta: [{ title: "Quick Learning Assessment — Nova Learn" }, { name: "description", content: "10 smart questions to personalize your learning." }] }),
  component: Assessment,
});

function Assessment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  // Fetch current user to get their grade for prefetching
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const res = await fetch('http://127.0.0.1:5000/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user;
    },
    staleTime: Infinity
  });

  // Background prefetching: load all chapters while user takes the quiz!
  useEffect(() => {
    if (user?.grade) {
      const subjects = ["Mathematics", "Science", "English", "Social Science", "Computer", "Languages"];
      subjects.forEach(subject => {
        queryClient.prefetchQuery({
          queryKey: ['chapters', user.grade, subject],
          queryFn: async () => {
            const res = await fetch(`http://127.0.0.1:5000/api/curriculum/class/${user.grade}/subject/${encodeURIComponent(subject)}/chapters`);
            if (!res.ok) throw new Error("Failed to prefetch");
            return res.json();
          },
          staleTime: Infinity
        });
      });
    }
  }, [user, queryClient]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['random-assessment'],
    queryFn: async () => {
      const res = await fetch('http://127.0.0.1:5000/api/assessment/random');
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true
  });

  const questions = data?.questions || [];

  const submit = () => {
    if (picked === null) return;
    const correct = picked === questions[i].correct;
    if (correct) setScore(score + 1);
    setTimeout(() => {
      if (i < questions.length - 1) {
        setI(i + 1);
        setPicked(null);
      } else {
        setDone(true);
      }
    }, 600);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative">
        <Blobs />
        <div className="z-10 flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <h2 className="text-xl font-bold">Generating your personalized quiz...</h2>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative">
        <Blobs />
        <div className="z-10 text-center">
          <h2 className="text-xl font-bold text-destructive mb-4">Oops! Failed to load questions.</h2>
          <ClayButton onClick={() => navigate({ to: "/app" })}>Go back</ClayButton>
        </div>
      </div>
    );
  }

  if (done) return <Result score={score} total={questions.length} onContinue={() => navigate({ to: "/app" })} />;

  const progress = ((i) / questions.length) * 100;
  const cur = questions[i];

  return (
    <div className="relative min-h-screen p-6 flex items-center justify-center">
      <Blobs />
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MascotBadge size={56} float={false} />
            <div>
              <h2 className="font-extrabold">Quick Learning Assessment</h2>
              <p className="text-xs text-muted-foreground">Question {i + 1} of {questions.length}</p>
            </div>
          </div>
          <div className="clay-sm bg-card px-4 py-2 rounded-2xl flex items-center gap-2 font-bold">
            <Timer className="w-4 h-4 text-primary" /> 0:42
          </div>
        </div>

        <div className="clay-sm bg-card h-3 rounded-full overflow-hidden">
          <div className="h-full gradient-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="clay-lg bg-card p-8 space-y-6">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold gradient-yellow text-amber-900">{cur.subject}</span>
          <h3 className="text-2xl font-black leading-snug">{cur.q}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {cur.options.map((opt, idx) => (
              <button
                key={opt}
                onClick={() => setPicked(idx)}
                className={cn(
                  "h-16 rounded-2xl font-bold text-left px-5 transition-all",
                  picked === idx
                    ? "gradient-primary text-white glow-purple scale-[1.02]"
                    : "clay-sm bg-card hover:-translate-y-0.5"
                )}
              >
                <span className="opacity-70 mr-3">{String.fromCharCode(65 + idx)}.</span> {opt}
              </button>
            ))}
          </div>
          <ClayButton size="lg" className="w-full" onClick={submit} disabled={picked === null}>
            {i < questions.length - 1 ? "Next question" : "Finish & see results"} <ArrowRight className="w-4 h-4" />
          </ClayButton>
        </div>

        <p className="text-center text-sm text-muted-foreground italic">
          <Sparkles className="inline w-3 h-3 mr-1" /> Take your time — there's no penalty for thinking!
        </p>
      </div>
    </div>
  );
}

function Result({ score, total, onContinue }: { score: number; total: number; onContinue: () => void }) {
  const pct = (score / total) * 100;
  const tier =
    pct >= 80 ? { label: "Advanced Learner", color: "gradient-primary", emoji: "🚀" } :
    pct >= 50 ? { label: "Average Learner", color: "gradient-cyan", emoji: "🌟" } :
    { label: "Beginner Learner", color: "gradient-peach", emoji: "🌱" };

  return (
    <div className="relative min-h-screen p-6 flex items-center justify-center">
      <Blobs />
      <div className="w-full max-w-2xl clay-lg bg-card p-8 space-y-6 text-center">
        <MascotBadge size={120} />
        <div>
          <p className="text-sm text-muted-foreground font-bold">Your assessment result</p>
          <h2 className="text-4xl font-black mt-2">You're a {tier.label} {tier.emoji}</h2>
        </div>
        <div className={cn("inline-flex items-center gap-3 px-6 py-3 rounded-2xl text-white font-bold clay-sm", tier.color)}>
          Score: {score}/{total} • {Math.round(pct)}%
        </div>

        <div className="grid sm:grid-cols-3 gap-4 pt-4">
          {[
            { icon: Target, label: "Focus area", value: "Algebra & Geometry", color: "gradient-yellow text-amber-900" },
            { icon: TrendingUp, label: "Pace", value: "Steady — 3 lessons/day", color: "gradient-cyan text-white" },
            { icon: Award, label: "Recommend", value: "Math, Science", color: "gradient-mint text-emerald-900" },
          ].map((c) => (
            <div key={c.label} className="clay-sm bg-card p-4 text-left">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-3", c.color)}>
                <c.icon className="w-5 h-5" />
              </div>
              <div className="text-xs text-muted-foreground font-bold">{c.label}</div>
              <div className="font-extrabold">{c.value}</div>
            </div>
          ))}
        </div>

        <ClayButton size="lg" className="w-full" onClick={onContinue}>Open my dashboard <ArrowRight className="w-4 h-4" /></ClayButton>
      </div>
    </div>
  );
}
