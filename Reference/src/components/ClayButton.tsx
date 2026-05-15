import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "cyan" | "yellow" | "peach" | "mint" | "ghost" | "white";
type Size = "sm" | "md" | "lg" | "icon";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: "gradient-primary text-primary-foreground glow-purple",
  cyan: "gradient-cyan text-white",
  yellow: "gradient-yellow text-amber-900",
  peach: "gradient-peach text-orange-900",
  mint: "gradient-mint text-emerald-900",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  white: "bg-card text-foreground",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-12 px-6 text-base",
  lg: "h-14 px-8 text-lg",
  icon: "h-11 w-11",
};

export const ClayButton = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-bold clay-sm",
        "transition-all duration-200 active:scale-[0.97] active:clay-pressed hover:-translate-y-0.5",
        "disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
ClayButton.displayName = "ClayButton";
