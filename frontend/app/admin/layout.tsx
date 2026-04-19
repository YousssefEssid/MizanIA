"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { NavbarThemeToggle } from "@/components/theme-toggle";
import { MizaniaLogo } from "@/components/mizania-mark";
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
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="flex flex-col gap-0.5">
            <MizaniaLogo className="h-8 max-w-[200px]" />
            <p className="text-xs text-muted-foreground">Superadmin console</p>
          </Link>
          <div className="flex items-center gap-3">
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
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
