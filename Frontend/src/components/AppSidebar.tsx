import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, Trophy, Calendar, Settings, GraduationCap, Medal, Brain, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useMe } from "@/hooks/useMe";

function navItems(isTeacher: boolean) {
  return [
    { to: "/app", label: "Home", icon: Home, exact: true },
    { to: "/app/subjects", label: "Subjects", icon: BookOpen },
    { to: "/app/quizzes", label: "Quizzes", icon: Trophy },
    ...(isTeacher ? [{ to: "/app/leaderboard", label: "Leaderboard", icon: Medal }] : []),
    ...(isTeacher ? [{ to: "/app/student-progress", label: "Progress", icon: BarChart3 }] : []),
    { to: "/app/concept-map", label: "Concept Map", icon: Brain },
    { to: "/app/planner", label: "Planner", icon: Calendar },
    { to: "/app/settings", label: "Settings", icon: Settings },
  ];
}

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [isOpen, setIsOpen] = useState(false);
  const { data: user } = useMe();
  const isTeacher = user?.role === "teacher";
  const items = navItems(!!isTeacher);

  return (
    <>
      <aside className="hidden lg:flex w-[88px] shrink-0 p-4 flex-col items-center gap-3 sticky top-0 h-screen z-40">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "h-14 w-14 rounded-2xl gradient-primary clay-sm flex items-center justify-center text-white cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg",
            isOpen ? "shadow-[0_0_20px_rgba(168,85,247,0.6)]" : "hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]",
          )}
          title="Toggle Navigation"
        >
          <GraduationCap className={cn("w-7 h-7 transition-all duration-300", isOpen ? "rotate-12 scale-110" : "")} />
        </div>

        <div
          className={cn(
            "grid transition-all duration-500 ease-in-out",
            isOpen ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0",
          )}
        >
          <div className="overflow-hidden">
            <nav className="clay-lg p-2 flex flex-col gap-2">
              {items.map((it) => {
                const active = it.exact ? path === it.to : path.startsWith(it.to);
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300",
                      active ? "gradient-primary text-white glow-purple scale-105" : "text-muted-foreground hover:bg-muted hover:scale-110 active:scale-95",
                    )}
                    title={it.label}
                  >
                    <it.icon className="w-5 h-5" />
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>

      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-30 clay-lg p-2 flex justify-around">
        {items.map((it) => {
          const active = it.exact ? path === it.to : path.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex-1 h-12 rounded-2xl flex items-center justify-center transition-all",
                active ? "gradient-primary text-white" : "text-muted-foreground",
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
