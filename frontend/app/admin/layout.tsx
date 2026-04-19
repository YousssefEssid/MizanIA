"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { NavbarThemeToggle } from "@/components/theme-toggle";
import { AvanciLogo } from "@/components/avanci-logo";
import { Button } from "@/components/ui/button";
import { RoleGate, useAuth } from "@/lib/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGate allow={["superadmin"]}>
      <Shell>{children}</Shell>
    </RoleGate>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="inline-flex">
            <AvanciLogo />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <p className="hidden text-xs text-muted-foreground sm:block">{user.email}</p>
            ) : null}
            <NavbarThemeToggle />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={signOut}
              className="gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
