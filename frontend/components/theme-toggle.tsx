"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Navbar dark mode switch — toggles explicit light/dark.
 * Uses `resolvedTheme` so "system" preference still shows the correct state.
 */
export function NavbarThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  if (!mounted) {
    return (
      <div
        className={cn("h-7 w-12 shrink-0 rounded-full bg-muted", className)}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title={isDark ? "Dark mode on" : "Light mode on"}
    >
      <Sun
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isDark ? "text-muted-foreground/50" : "text-foreground",
        )}
        aria-hidden
      />
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isDark ? "bg-primary/35" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute left-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border transition-transform duration-200 ease-out",
            isDark && "translate-x-5",
          )}
        >
          {isDark ? (
            <Moon className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Sun className="h-3.5 w-3.5" aria-hidden />
          )}
        </span>
      </button>
      <Moon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isDark ? "text-foreground" : "text-muted-foreground/50",
        )}
        aria-hidden
      />
    </div>
  );
}
