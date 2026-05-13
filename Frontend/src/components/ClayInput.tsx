import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
}

export const ClayInput = forwardRef<HTMLInputElement, Props>(
  ({ className, label, icon, id, ...props }, ref) => (
    <div className="space-y-2">
      {label && (
        <label htmlFor={id} className="text-sm font-bold text-foreground/80 ml-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full h-14 rounded-2xl bg-card clay-pressed px-5 text-base font-medium",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40",
            icon && "pl-12",
            className
          )}
          {...props}
        />
      </div>
    </div>
  )
);
ClayInput.displayName = "ClayInput";
