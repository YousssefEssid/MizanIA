import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * AvancI brand lockup: mark PNG + Dancing Script wordmark.
 * Dark mode uses the same mark inverted to white for contrast.
 * The leading "A" and trailing "I" use the brand accent (#2596be cyan-blue)
 * to emphasize the "AI" framing.
 */
export function AvanciLogo({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      aria-label="AvancI"
    >
      <span className="relative h-12 w-12 shrink-0" aria-hidden>
        <Image
          src="/brand/avanci-mark-light-theme.png"
          alt=""
          width={96}
          height={96}
          className="h-12 w-12 object-contain object-center dark:brightness-0 dark:invert"
          priority={priority}
        />
      </span>
      <span className="font-wordmark text-[1.7rem] font-semibold leading-none">
        <span className="text-[hsl(var(--brand-olive))]">A</span>
        <span className="text-foreground">vanc</span>
        <span className="text-[hsl(var(--brand-olive))]">I</span>
      </span>
    </span>
  );
}

/** Wordmark only (no icon) where horizontal space is tight. */
export function AvanciWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn("font-wordmark text-xl font-semibold leading-none", className)}
      aria-label="AvancI"
    >
      <span className="text-[hsl(var(--brand-olive))]">A</span>
      <span className="text-foreground">vanc</span>
      <span className="text-[hsl(var(--brand-olive))]">I</span>
    </span>
  );
}
