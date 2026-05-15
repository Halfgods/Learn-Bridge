import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronRight,
  Search,
  Sparkles,
  FileText,
  ArrowLeft,
  BookOpen,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiPath } from "@/lib/api";

export const Route = createFileRoute("/app/subject/$subjectId")({
  head: () => ({ meta: [{ title: "Subject — Nova Learn" }] }),
  component: SubjectExplorer,
});

/**
 * The subjectId in the URL is the DB subject name lowercased & spaces→hyphens.
 * We reverse that slug to get the exact DB name to query.
 * e.g. "social-science" → "Social Science", "mathematics" → "Mathematics"
 */
function slugToSubjectName(slug: string): string {
  return decodeURIComponent(slug)
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Longest Common Subsequence
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

function SubjectExplorer() {
  const { subjectId } = Route.useParams();
  // Derive the DB subject name from the slug — no static map needed
  const dbSubjectName = slugToSubjectName(subjectId);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token");
      const res = await fetch(apiPath("/api/auth/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      return data.user;
    },
    retry: false,
  });

  const std = user?.grade || 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ["chapters", std, dbSubjectName],
    queryFn: async () => {
      const res = await fetch(
        apiPath(
          `/api/curriculum/class/${std}/subject/${encodeURIComponent(dbSubjectName)}/chapters`,
        ),
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!user,
  });

  const chapters = data?.chapters || [];

  const chapterProgressQ = useQuery({
    queryKey: ["chapter-progress", dbSubjectName],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) return [];
      const res = await fetch(apiPath("/api/chapter/progress"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch progress");
      const all = await res.json();
      return (Array.isArray(all) ? all : []).filter(
        (p: any) => p.subjectName?.toLowerCase() === dbSubjectName.toLowerCase(),
      );
    },
    enabled: !!user,
  });

  const chapterScores = new Map<string, number>();
  for (const p of chapterProgressQ.data || []) {
    chapterScores.set(
      p.chapterName,
      p.quizScore != null && p.totalQuestions > 0
        ? Math.round((p.quizScore / p.totalQuestions) * 100)
        : 0,
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <Link
        to="/app"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <header className="clay-lg bg-card p-6 flex items-center gap-5">
        <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center clay-sm text-white">
          <BookOpen className="w-8 h-8" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-black">{dbSubjectName}</h1>
          <p className="text-sm text-muted-foreground">
            {chapters.length} chapters • Adaptive learning path
          </p>
        </div>
      </header>

      {/* Search + filters */}
      <div className="flex gap-3">
        <div className="flex-1 clay-pressed bg-card rounded-2xl px-4 h-12 flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search chapters & topics..."
            className="bg-transparent outline-none flex-1 font-medium text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tree */}
      <div className="clay-lg bg-card p-4 space-y-2">
        {isLoading && (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="p-8 text-center text-destructive font-bold">Failed to load chapters.</div>
        )}
        {!isLoading && !error && chapters.length === 0 && (
          <div className="p-8 text-center text-muted-foreground font-bold">
            No chapters found for this subject.
          </div>
        )}

        {chapters
          .filter((ch: any) => {
            if (!searchQuery) return true;
            // Subsequence match: all characters of the query appear in order in the chapter name
            return computeLCS(ch.chapterName, searchQuery) === searchQuery.length;
          })
          .map((ch: any, idx: number) => {
            const difficulty = (idx % 3) + 1;
            const done = chapterScores.get(ch.chapterName) ?? 0;

            return (
              <div key={ch.chapterName} className="rounded-2xl">
                <Link
                  to="/app/chapter/$chapterId"
                  params={{ chapterId: encodeURIComponent(ch.chapterName) }}
                  search={{ subjectName: dbSubjectName, std: std }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted transition-colors group"
                >
                  <div
                    className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center clay-sm",
                      difficulty === 1 && "gradient-mint text-emerald-900",
                      difficulty === 2 && "gradient-cyan text-white",
                      difficulty === 3 && "gradient-peach text-orange-900",
                    )}
                  >
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-extrabold">{ch.chapterName}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-md">
                      {ch.description || "Read chapter notes and pdf"}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 w-32">
                    <div className="flex-1 clay-pressed h-2 rounded-full overflow-hidden">
                      <div className="h-full gradient-primary" style={{ width: `${done}%` }} />
                    </div>
                    <span className="text-xs font-bold w-8 text-right">{done}%</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </div>
            );
          })}
      </div>
    </div>
  );
}
