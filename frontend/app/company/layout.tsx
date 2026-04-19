"use client";

import { usePathname } from "next/navigation";
import { CompanyShell } from "@/components/company-shell";
import { RoleGate } from "@/lib/auth";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  return (
    <RoleGate allow={["hr_admin", "superadmin"]}>
      <CompanyShell pathname={pathname}>{children}</CompanyShell>
    </RoleGate>
  );
}
