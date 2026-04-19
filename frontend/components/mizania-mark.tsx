import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO = "/mizania-logo.png";

/** Full horizontal brand (icon + MizanIA wordmark) — use in nav headers. */
export function MizaniaLogo({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={LOGO}
      alt="MizanIA"
      width={240}
      height={56}
      priority={priority}
      className={cn("h-9 w-auto max-w-[min(100%,240px)] object-contain object-left", className)}
    />
  );
}

/** @deprecated Prefer MizaniaLogo; kept as compact alias for legacy imports. */
export function MizaniaMark({ className }: { className?: string }) {
  return <MizaniaLogo className={cn("h-8 max-w-[180px]", className)} />;
}

/** Text fallback matching brand colors when the PNG is not used. */
export function MizaniaWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-semibold tracking-tight", className)}>
      <span className="text-foreground">Mizan</span>
      <span className="text-primary">IA</span>
    </span>
  );
}
