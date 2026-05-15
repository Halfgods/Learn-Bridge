import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Medal, Loader2 } from "lucide-react";
import { apiPath, parseApiJson } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — Nova Learn" }] }),
  component: LeaderboardPage,
});

type Row = { rank: number; name: string; xp: number; lessons: number };

function LeaderboardPage() {
  const { data: user, isLoading: meLoading } = useMe();
  const { data, isLoading, error } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(apiPath("/api/leaderboard"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await parseApiJson<{ rows?: Row[]; error?: string }>(res);
      if (!res.ok) throw new Error(body.error || "forbidden");
      return body.rows ?? [];
    },
    enabled: user?.role === "teacher",
  });

  if (meLoading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== "teacher") {
    return (
      <div className="p-10 max-w-lg mx-auto text-center space-y-4">
        <p className="font-bold text-muted-foreground">The class leaderboard is available for teacher accounts.</p>
        <Link to="/app" className="text-primary font-bold">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-black flex items-center gap-3">
          <Medal className="w-9 h-9 text-clay-yellow" /> Leaderboard
        </h1>
        <p className="text-muted-foreground mt-1">Top learners ranked by quiz scores.</p>
      </header>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      )}
      {error && <p className="text-destructive font-bold">Could not load leaderboard.</p>}

      <ul className="space-y-2">
        {(data || []).map((r) => (
          <li
            key={r.rank}
            className={cn(
              "clay-lg p-4 flex items-center gap-4 bg-card",
              r.rank <= 3 && "ring-2 ring-primary/30",
            )}
          >
            <div
              className={cn(
                "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 clay-sm",
                r.rank === 1 && "gradient-yellow text-amber-900",
                r.rank === 2 && "gradient-cyan text-white",
                r.rank === 3 && "gradient-peach text-orange-900",
                r.rank > 3 && "bg-muted text-muted-foreground",
              )}
            >
              {r.rank}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground font-bold">{r.lessons} lessons completed</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-black text-primary">{r.xp.toLocaleString()}</div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase">XP</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
