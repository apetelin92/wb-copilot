import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { getCurrentSessionUser } from "@/server/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/auth");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
