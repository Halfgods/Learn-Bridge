import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "h-11 w-11 rounded-2xl clay-sm flex items-center justify-center",
        "transition-all duration-300 hover:scale-110 active:scale-95",
        className,
        dark
          ? "bg-[oklch(0.26_0.04_280)] text-[oklch(0.88_0.15_95)]"
          : "bg-white text-[oklch(0.62_0.22_295)]"
      )}
    >
      <div className="relative w-5 h-5">
        <Sun
          className={cn(
            "absolute inset-0 w-5 h-5 transition-all duration-300",
            dark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50"
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 w-5 h-5 transition-all duration-300",
            dark ? "opacity-0 -rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
          )}
        />
      </div>
    </button>
  );
}
