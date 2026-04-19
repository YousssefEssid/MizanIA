"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { NavbarThemeToggle } from "@/components/theme-toggle";
import { MizaniaLogo } from "@/components/mizania-mark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const links = [
  { href: "/company/dashboard", label: "Dashboard" },
  { href: "/company/results", label: "Employee results" },
  { href: "/company/requests", label: "Requests" },
  { href: "/company/repayments", label: "Repayments" },
  { href: "/company/wallet", label: "Wallet" },
];

export function CompanyShell({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  const { user, signOut } = useAuth();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
        <div className="flex flex-col gap-2 border-b border-border px-4 py-4">
          <MizaniaLogo className="max-w-[200px]" />
          <p className="text-xs text-muted-foreground">Company workspace</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                pathname.startsWith(l.href) &&
                  "bg-accent text-accent-foreground hover:bg-accent",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-border p-3">
          {user ? (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
              <p className="font-medium text-foreground">{user.email}</p>
              <p className="text-muted-foreground">HR · Employer #{user.employer_id ?? "—"}</p>
            </div>
          ) : null}
          <NavbarThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={signOut}
            className="justify-start gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center md:hidden">
            <MizaniaLogo className="h-8 max-w-[200px]" />
          </div>
          <p className="ml-auto hidden text-sm text-muted-foreground md:block md:max-w-xl">
            Operational salary advances — structured and auditable.
          </p>
        </header>
        <div className="border-b border-border bg-muted/30 px-4 py-2 md:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav className="flex flex-wrap gap-2">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground",
                    pathname.startsWith(l.href) && "bg-background text-foreground shadow-sm",
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <NavbarThemeToggle />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={signOut}
                className="gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
