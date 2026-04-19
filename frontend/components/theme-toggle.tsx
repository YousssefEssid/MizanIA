"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Navbar dark mode switch: toggles explicit light/dark.
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
        className={cn("h-8 w-14 shrink-0 rounded-full bg-muted", className)}
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
          "inline-flex h-8 w-14 shrink-0 rounded-full border border-border p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isDark ? "bg-primary/35" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "block h-6 w-6 rounded-full bg-background shadow-sm ring-1 ring-border/80 transition-transform duration-200 ease-out will-change-transform",
            isDark ? "translate-x-6" : "translate-x-0",
          )}
          aria-hidden
        />
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
