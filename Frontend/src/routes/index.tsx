import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Rocket, Brain, ArrowRight } from "lucide-react";
import { Blobs } from "@/components/Blobs";
import { ClayButton } from "@/components/ClayButton";
import { MascotBadge } from "@/components/MascotBadge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nova Learn — AI-powered learning for Grades 1–10" },
      { name: "description", content: "A premium AI tutor for school students. Personalized lessons, smart quizzes, and a friendly AI study buddy." },
      { property: "og:title", content: "Nova Learn — AI-powered learning" },
      { property: "og:description", content: "Personalized AI tutoring for Grades 1–10. CBSE, ICSE, IB and State Board." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Blobs />
      <header className="px-6 lg:px-12 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-2xl gradient-primary clay-sm flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-xl">Nova Learn</span>
        </div>
        <Link to="/login">
          <ClayButton variant="white" size="sm">Log in</ClayButton>
        </Link>
      </header>

      <main className="px-6 lg:px-12 pt-8 pb-24 grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
        <div className="space-y-8">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full clay-sm bg-card text-sm font-bold">
            <Sparkles className="w-4 h-4 text-clay-yellow" /> Built for Grades 1–10
          </span>
          <h1 className="text-5xl lg:text-7xl font-black leading-[1.05] tracking-tight">
            Learn smarter with your{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
              AI study buddy
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Personalized lessons, gamified quizzes, and a friendly AI tutor that adapts to how you learn — across CBSE, ICSE, IB and State Boards.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/signup">
              <ClayButton size="lg">Start learning free <ArrowRight className="w-5 h-5" /></ClayButton>
            </Link>
            <Link to="/login">
              <ClayButton variant="white" size="lg">I have an account</ClayButton>
            </Link>
          </div>
          <div className="flex gap-6 pt-4">
            {[
              { icon: Brain, label: "AI tutor 24/7" },
              { icon: Rocket, label: "Adaptive learning" },
              { icon: Sparkles, label: "Fun rewards" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-sm font-bold text-foreground/70">
                <div className="h-9 w-9 rounded-xl clay-sm bg-card flex items-center justify-center">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative h-[500px] flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-80 h-80 rounded-full gradient-hero blur-3xl opacity-60" />
          </div>
          <MascotBadge size={320} />
          {/* Floating cards */}
          <div className="absolute top-8 left-0 clay-lg bg-card p-4 w-52 animate-float" style={{ animationDelay: "-2s" }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl gradient-cyan flex items-center justify-center text-white font-black">A+</div>
              <div>
                <div className="font-extrabold">Quiz aced!</div>
                <div className="text-xs text-muted-foreground">+120 XP earned</div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-8 right-0 clay-lg bg-card p-4 w-56 animate-float" style={{ animationDelay: "-5s" }}>
            <div className="text-xs font-bold text-muted-foreground mb-2">Today's streak</div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-yellow)" }}>7🔥</span>
              <span className="text-sm text-muted-foreground">days strong</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
