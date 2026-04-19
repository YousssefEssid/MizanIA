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
  { href: "/employee", label: "Home" },
  { href: "/employee/request", label: "Request advance" },
];

export function EmployeeShell({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  const { user, signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/employee" className="flex flex-col gap-0.5">
            <MizaniaLogo className="h-8 max-w-[200px]" />
            <p className="text-xs text-muted-foreground">Employee portal</p>
          </Link>
          {user ? (
            <div className="hidden text-right text-xs sm:block">
              <p className="font-medium text-foreground">{user.email}</p>
              <p className="text-muted-foreground">Employee #{user.employee_profile_id ?? "—"}</p>
            </div>
          ) : null}
        </div>
        <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2">
          <div className="flex flex-wrap gap-2">
            {links.map((l) => {
              const active =
                l.href === "/employee"
                  ? pathname === "/employee"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                    active && "bg-muted text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <NavbarThemeToggle className="shrink-0" />
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
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
