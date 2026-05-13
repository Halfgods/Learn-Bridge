import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, Trophy, Calendar, Settings, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/subjects", label: "Subjects", icon: BookOpen },
  { to: "/app/quizzes", label: "Quizzes", icon: Trophy },
  { to: "/app/planner", label: "Planner", icon: Calendar },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-[88px] shrink-0 p-4 flex-col items-center gap-3">
        <div className="h-14 w-14 rounded-2xl gradient-primary clay-sm flex items-center justify-center text-white">
          <GraduationCap className="w-7 h-7" />
        </div>
        <nav className="clay-lg p-2 flex flex-col gap-2 mt-2">
          {items.map((it) => {
            const active = it.exact ? path === it.to : path.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center transition-all",
                  active ? "gradient-primary text-white glow-purple" : "text-muted-foreground hover:bg-muted"
                )}
                title={it.label}
              >
                <it.icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-30 clay-lg p-2 flex justify-around">
        {items.map((it) => {
          const active = it.exact ? path === it.to : path.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex-1 h-12 rounded-2xl flex items-center justify-center transition-all",
                active ? "gradient-primary text-white" : "text-muted-foreground"
              )}
            >
              <it.icon className="w-5 h-5" />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
