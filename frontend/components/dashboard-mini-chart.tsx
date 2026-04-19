"use client";

import { cn } from "@/lib/utils";

const heights = [42, 55, 48, 72, 64, 78, 58];

export function DashboardMiniChart({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-40 items-end gap-2 rounded-lg border border-border bg-muted/20 px-3 pb-2 pt-4",
        className,
      )}
      role="img"
      aria-label="Requests trend illustration"
    >
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm bg-primary/80 dark:bg-primary/60"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
