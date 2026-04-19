"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { NavbarThemeToggle } from "@/components/theme-toggle";
import { AvanciLogo } from "@/components/avanci-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const links = [
  { href: "/company/dashboard", label: "Dashboard" },
  { href: "/company/upload", label: "Upload" },
  { href: "/company/results", label: "Results" },
  { href: "/company/policy", label: "Policy" },
  { href: "/company/requests", label: "Requests" },
  { href: "/company/repayments", label: "Payroll deductions" },
  { href: "/company/wallet", label: "Wallet" },
];

function isActive(pathname: string, href: string) {
  if (href === "/company/dashboard") return pathname.startsWith("/company/dashboard");
  return pathname.startsWith(href);
}

export function CompanyShell({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  const { user, signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/company/dashboard" className="inline-flex shrink-0">
              <AvanciLogo />
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              {user ? (
                <div className="hidden text-right text-xs leading-tight md:block">
                  <p className="font-medium text-foreground">{user.email}</p>
                  <p className="text-muted-foreground">
                    HR · Employer #{user.employer_id ?? "N/A"}
                  </p>
                </div>
              ) : null}
              <NavbarThemeToggle />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={signOut}
                className="gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
          <nav
            aria-label="Workspace"
            className="-mx-1 flex flex-wrap items-center gap-1 overflow-x-auto pb-1"
          >
            {links.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    active &&
                      "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:py-8">{children}</main>
    </div>
  );
}
