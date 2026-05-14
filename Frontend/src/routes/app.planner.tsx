import { createFileRoute } from "@tanstack/react-router";
import { Calendar, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/planner")({
  head: () => ({ meta: [{ title: "Planner — Nova Learn" }] }),
  component: PlannerPage,
});

function PlannerPage() {
  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-black flex items-center gap-3">
          <Calendar className="w-9 h-9 text-primary" /> Planner
        </h1>
        <p className="text-muted-foreground mt-1">Sketch your week — same friendly layout as the rest of the app.</p>
      </header>
      <div className="clay-lg bg-card p-8 space-y-4">
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
          <div key={d} className="flex items-center gap-4 clay-sm p-4 rounded-2xl">
            <div className="h-12 w-12 rounded-xl gradient-primary text-white font-black flex items-center justify-center shrink-0">
              {d.slice(0, 1)}
            </div>
            <div className="flex-1">
              <div className="font-extrabold">{d}</div>
              <div className="text-sm text-muted-foreground">Add tasks from your subjects & quizzes</div>
            </div>
            <CheckCircle2 className="w-6 h-6 text-muted-foreground/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
