"use client";

import { usePathname } from "next/navigation";
import { EmployeeShell } from "@/components/employee-shell";
import { RoleGate } from "@/lib/auth";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  return (
    <RoleGate allow={["employee"]}>
      <EmployeeShell pathname={pathname}>{children}</EmployeeShell>
    </RoleGate>
  );
}
