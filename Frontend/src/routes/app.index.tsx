import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Calculator, Beaker, BookOpen, Globe2, Cpu, Languages, Flame, Bell, ArrowRight, Trophy, Clock, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiPath } from "@/lib/api";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Nova Learn" }] }),
  component: Dashboard,
});

const subjects = [
  { id: "math", name: "Mathematics", icon: Calculator, gradient: "gradient-primary", text: "text-white", progress: 68, lessons: 24 },
  { id: "science", name: "Science", icon: Beaker, gradient: "gradient-cyan", text: "text-white", progress: 42, lessons: 18 },
  { id: "english", name: "English", icon: BookOpen, gradient: "gradient-yellow", text: "text-amber-900", progress: 81, lessons: 15 },
  { id: "social", name: "Social Science", icon: Globe2, gradient: "gradient-peach", text: "text-orange-900", progress: 35, lessons: 20 },
  { id: "computer", name: "Computer", icon: Cpu, gradient: "gradient-mint", text: "text-emerald-900", progress: 56, lessons: 12 },
  { id: "languages", name: "Languages", icon: Languages, gradient: "gradient-primary", text: "text-white", progress: 22, lessons: 16 },
];

function Dashboard() {
  const navigate = useNavigate();
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error("No token");
      
      const res = await fetch(apiPath("/api/auth/me"), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      return data.user;
    },
    retry: false
  });

  if (error) {
    navigate({ to: "/login" });
    return null;
  }

  const firstName = user?.name ? user.name.split(' ')[0] : '...';

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8">
      {/* Greeting */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground font-bold">Wednesday, May 13</p>
          <h1 className="text-3xl lg:text-4xl font-black mt-1">Hi {firstName} 👋</h1>
          <p className="text-muted-foreground">Ready to crush today's goals?</p>
        </div>
        <div className="flex gap-2">
          <button className="h-12 w-12 rounded-2xl clay-sm bg-card flex items-center justify-center"><Search className="w-5 h-5" /></button>
          <button className="h-12 w-12 rounded-2xl clay-sm bg-card flex items-center justify-center relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
          </button>
        </div>
      </header>

      {/* Streak + widgets */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="clay-lg gradient-primary text-white p-6 md:col-span-2 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/20 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold opacity-90"><Flame className="w-4 h-4 text-clay-yellow"/> Daily streak</div>
              <div className="text-5xl font-black mt-2">7 days</div>
              <p className="text-sm opacity-90 mt-1">Keep it up — finish 1 lesson to extend!</p>
            </div>
            <div className="text-7xl">🔥</div>
          </div>
        </div>
        <div className="clay-lg bg-card p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold"><Trophy className="w-4 h-4 text-clay-yellow"/> XP this week</div>
          <div className="text-4xl font-black bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-yellow)" }}>1,240</div>
          <div className="clay-pressed h-2 rounded-full overflow-hidden"><div className="h-full gradient-yellow" style={{ width: "62%" }}/></div>
          <p className="text-xs text-muted-foreground">760 XP to next badge</p>
        </div>
      </div>

      {/* Subjects grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold">Your subjects</h2>
          <Link to="/app/subjects" className="text-sm font-bold text-primary flex items-center gap-1">View all <ArrowRight className="w-4 h-4"/></Link>
        </div>
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
                <span className="text-xs font-bold text-muted-foreground">{s.progress}% complete</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform"/>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Today */}
      <section className="grid md:grid-cols-2 gap-4">
        <div className="clay-lg bg-card p-6">
          <h3 className="font-extrabold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-primary"/> Upcoming today</h3>
          <ul className="space-y-3">
            {[
              { t: "Algebra quiz", time: "4:00 PM", color: "gradient-cyan text-white" },
              { t: "Read: Photosynthesis", time: "5:30 PM", color: "gradient-yellow text-amber-900" },
              { t: "Revision: Tenses", time: "7:00 PM", color: "gradient-peach text-orange-900" },
            ].map((it) => (
              <li key={it.t} className="flex items-center gap-3 clay-sm bg-card p-3">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs", it.color)}>{it.time.split(":")[0]}</div>
                <div className="flex-1"><div className="font-bold">{it.t}</div><div className="text-xs text-muted-foreground">{it.time}</div></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="clay-lg gradient-cyan text-white p-6 relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/20 blur-2xl" />
          <h3 className="font-extrabold mb-2">AI recommendation ✨</h3>
          <p className="text-sm opacity-90 mb-4">Based on yesterday's quiz, spend 15 min on <strong>Linear Equations</strong> to boost your weak area.</p>
          <Link to="/app/subject/$subjectId" params={{ subjectId: "math" }} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-primary font-bold clay-sm">
            Start now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
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
        <circle cx="22" cy="22" r={r} stroke="url(#g)" strokeWidth="5" fill="none" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
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
