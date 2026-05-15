import mascot from "@/assets/mascot.png";
import { cn } from "@/lib/utils";

export function MascotBadge({ className, size = 96, float = true }: { className?: string; size?: number; float?: boolean }) {
  return (
    <img
      src={mascot}
      alt="Nova, your AI study buddy"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("object-contain drop-shadow-[0_20px_30px_rgba(120,80,200,0.35)]", float && "animate-float", className)}
    />
  );
}
