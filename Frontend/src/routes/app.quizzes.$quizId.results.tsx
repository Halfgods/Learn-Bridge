import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Medal, Trophy, Award } from "lucide-react";
import { format, parseISO } from "date-fns";
import { apiPath, parseApiJson } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { ClayButton } from "@/components/ClayButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/quizzes/$quizId/results")({
  head: () => ({ meta: [{ title: "Quiz results — Nova Learn" }] }),
  component: QuizResultsPage,
});

type Attempt = {
  studentEmail: string;
  studentName?: string;
  score: number;
  total: number;
  submittedAt?: string;
};

const rankIcons = [Trophy, Medal, Award];

function QuizResultsPage() {
  const { quizId } = Route.useParams();
  const { data: me } = useMe();

  const { data, isLoading, error } = useQuery({
    queryKey: ["quiz-attempts", quizId],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath(`/api/teacher/quizzes/${quizId}/attempts`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await parseApiJson<{ attempts?: Attempt[]; error?: string }>(res);
      if (!res.ok) throw new Error(body.error || "Failed");
      return body.attempts ?? [];
    },
    enabled: me?.role === "teacher",
  });

  if (me?.role !== "teacher") {
    return (
      <div className="p-10 max-w-md mx-auto text-center space-y-4">
        <p className="font-bold">Only teachers can view class results.</p>
        <Link to="/app/quizzes">
          <ClayButton variant="white">Back</ClayButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <Link
        to="/app/quizzes"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> All quizzes
      </Link>
      <h1 className="text-3xl font-black">Leaderboard</h1>
      <p className="text-muted-foreground text-sm font-bold">Students ranked by score.</p>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      )}
      {error && <p className="text-destructive font-bold">Could not load results.</p>}

      {!isLoading && data && data.length === 0 && (
        <p className="clay-lg bg-card p-6 text-center font-bold text-muted-foreground">No submissions yet.</p>
      )}

      <ul className="space-y-2">
        {(data || []).map((row, i) => {
          const pct = row.total > 0 ? Math.round((row.score / row.total) * 100) : 0;
          const RankIcon = rankIcons[i];
          return (
            <li
              key={row.studentEmail}
              className={cn(
                "clay-lg bg-card p-4 flex flex-wrap items-center gap-4",
                i < 3 && "ring-2 ring-primary/20",
              )}
            >
              <div
                className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 clay-sm",
                  i === 0 && "gradient-yellow text-amber-900",
                  i === 1 && "gradient-cyan text-white",
                  i === 2 && "gradient-peach text-orange-900",
                  i >= 3 && "bg-muted text-muted-foreground",
                )}
              >
                {RankIcon ? <RankIcon className="w-5 h-5" /> : <span className="font-black text-sm">{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold truncate">{row.studentName || row.studentEmail}</div>
                <div className="text-xs text-muted-foreground font-bold truncate">{row.studentEmail}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-black text-primary">{row.score}/{row.total}</div>
                <div className="text-xs font-bold text-muted-foreground">{pct}%</div>
              </div>
              {row.submittedAt && (
                <div className="text-[10px] text-muted-foreground font-bold shrink-0 w-24 text-right">
                  {format(parseISO(row.submittedAt), "MMM d, h:mm a")}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
