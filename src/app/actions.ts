"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE_NAME, signInWithEmail } from "@/server/modules/auth/service";
import { acceptWorkspaceInviteByToken, createWorkspaceInvite, revokeWorkspaceInvite } from "@/server/modules/auth/invite.service";
import { requireCurrentSessionUserRole } from "@/server/modules/auth/session";
import { connectWbAccount } from "@/server/modules/wb/service";
import { retrySyncRun, runWbSync } from "@/server/modules/wb/sync.service";
import { upsertCashInputs } from "@/server/modules/risk/service";
import { importCostProfilesFromCsv, upsertCostProfileAndRebuild } from "@/server/modules/costs/service";
import { SyncTrigger, UserRole } from "@prisma/client";
import { ensureDemoWorkspaceReady } from "@/server/modules/demo/service";
import type { DemoScenarioKey } from "@/server/modules/demo/scenarios";
import { DEMO_ACCOUNT_EMAIL, LIVE_OWNER_EMAIL, type WorkspaceKind } from "@/server/modules/workspace/constants";
import { env } from "@/server/lib/env";
import { humanizeSyncErrorMessage } from "@/server/modules/ops-status/service";
import { AppError } from "@/server/lib/errors";

function revalidateAppScreens() {
  ["/", "/onboarding", "/dashboard", "/skus", "/abc-analysis", "/supply", "/cash-gap", "/insights", "/settings"].forEach((path) => {
    revalidatePath(path);
  });
}

function setSessionCookie(userId: string) {
  cookies().set(AUTH_COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });
}

function getErrorRedirectMessage(error: unknown, fallback: string) {
  if (error instanceof AppError) {
    return encodeURIComponent(error.message);
  }

  return encodeURIComponent(fallback);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/auth?error=missing_email");
  }

  try {
    const user = await signInWithEmail(email);
    setSessionCookie(user.id);
  } catch (error) {
    redirect(`/auth?error=${getErrorRedirectMessage(error, "Не удалось выполнить вход.")}`);
  }

  redirect("/");
}

export async function loginDemoAction() {
  if (!env.authAllowDemoLogin) {
    redirect("/auth?error=Демо-вход отключён в этом окружении.");
  }

  await ensureDemoWorkspaceReady();
  const user = await signInWithEmail(DEMO_ACCOUNT_EMAIL, { workspaceKind: "demo" });
  setSessionCookie(user.id);

  redirect("/");
}

export async function switchWorkspaceAction(workspaceKind: WorkspaceKind) {
  await requireCurrentSessionUserRole(UserRole.ADMIN);

  if (workspaceKind === "demo" && !env.authAllowDemoLogin) {
    redirect("/settings?accessError=Демо-переключение отключено в этом окружении.");
  }

  if (workspaceKind === "demo") {
    await ensureDemoWorkspaceReady();
  }

  const email = workspaceKind === "demo" ? DEMO_ACCOUNT_EMAIL : LIVE_OWNER_EMAIL;
  const user = await signInWithEmail(email, { workspaceKind });

  setSessionCookie(user.id);

  revalidateAppScreens();
  redirect("/dashboard");
}

export async function seedDemoWorkspaceAction() {
  await requireCurrentSessionUserRole(UserRole.ADMIN);
  await ensureDemoWorkspaceReady();
  revalidateAppScreens();
  redirect("/dashboard");
}

export async function applyDemoScenarioAction(scenarioKey: DemoScenarioKey) {
  await requireCurrentSessionUserRole(UserRole.ADMIN);
  await ensureDemoWorkspaceReady(scenarioKey);
  const user = await signInWithEmail(DEMO_ACCOUNT_EMAIL, { workspaceKind: "demo" });
  setSessionCookie(user.id);

  revalidateAppScreens();
  redirect("/dashboard");
}

export async function acceptInviteAction(token: string) {
  try {
    const user = await acceptWorkspaceInviteByToken(token);
    setSessionCookie(user.id);
  } catch (error) {
    redirect(`/auth?error=${getErrorRedirectMessage(error, "Приглашение недействительно.")}`);
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  cookies().delete(AUTH_COOKIE_NAME);
  redirect("/auth");
}

export async function connectWbAction(formData: FormData) {
  await requireCurrentSessionUserRole(UserRole.ADMIN);

  try {
    await connectWbAccount({
      name: String(formData.get("name") ?? "WB Кабинет").trim(),
      apiToken: String(formData.get("apiToken") ?? "").trim(),
      cabinetId: String(formData.get("cabinetId") ?? "").trim() || undefined
    });
  } catch (error) {
    redirect(`/onboarding?connectionError=${getErrorRedirectMessage(error, "Не удалось сохранить подключение WB.")}`);
  }

  revalidateAppScreens();
  redirect("/onboarding");
}

export async function runSyncAction() {
  await requireCurrentSessionUserRole(UserRole.ADMIN);

  try {
    await runWbSync({ trigger: SyncTrigger.MANUAL });
  } catch (error) {
    redirect(`/settings?syncError=${encodeURIComponent(humanizeSyncErrorMessage(error instanceof Error ? error.message : String(error)) ?? "Не удалось выполнить синхронизацию.")}`);
  }

  revalidateAppScreens();
  redirect("/dashboard");
}

export async function retrySyncRunAction(syncRunId: string) {
  await requireCurrentSessionUserRole(UserRole.ADMIN);

  try {
    await retrySyncRun(syncRunId);
  } catch (error) {
    redirect(`/settings?syncError=${encodeURIComponent(humanizeSyncErrorMessage(error instanceof Error ? error.message : String(error)) ?? "Не удалось повторить синхронизацию.")}`);
  }

  revalidateAppScreens();
  redirect("/settings");
}

export async function saveCashInputsAction(formData: FormData) {
  const snapshotDate = String(formData.get("snapshotDate") ?? "");
  const availableRub = Number(String(formData.get("availableRub") ?? "0"));
  const title = String(formData.get("title") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "");
  const amountRub = Number(String(formData.get("amountRub") ?? "0"));
  const commitmentType = String(formData.get("commitmentType") ?? "OTHER");
  const notes = String(formData.get("notes") ?? "").trim();

  await upsertCashInputs({
    snapshot: snapshotDate
      ? {
          snapshotDate: new Date(snapshotDate),
          availableRub,
          notes: notes || undefined
        }
      : undefined,
    commitments:
      title && dueDate && amountRub > 0
        ? [
            {
              title,
              dueDate: new Date(dueDate),
              amountRub,
              commitmentType: commitmentType as "TAX" | "PAYROLL" | "SUPPLIER" | "OPERATIONS" | "OTHER",
              notes: notes || undefined
            }
          ]
        : [],
    replaceCommitments: false
  });

  revalidateAppScreens();
  redirect("/cash-gap");
}

export async function saveCostProfileAction(skuId: string, formData: FormData) {
  await upsertCostProfileAndRebuild(skuId, {
    effectiveFrom: new Date(String(formData.get("effectiveFrom") ?? new Date().toISOString().slice(0, 10))),
    cogsRub: Number(String(formData.get("cogsRub") ?? "0")),
    packagingRub: Number(String(formData.get("packagingRub") ?? "0")),
    handlingRub: Number(String(formData.get("handlingRub") ?? "0")),
    otherUnitCostRub: Number(String(formData.get("otherUnitCostRub") ?? "0")),
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    isComplete: String(formData.get("isComplete") ?? "off") === "on"
  });

  revalidateAppScreens();
  revalidatePath(`/skus/${skuId}`);
  redirect(`/skus/${skuId}`);
}

export async function importCostProfilesFileAction(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/skus?costImportError=Выберите CSV-файл с затратами.");
  }

  try {
    const result = await importCostProfilesFromCsv(await file.text());
    revalidateAppScreens();
    redirect(`/skus?profitability=incomplete&costImportSuccess=${encodeURIComponent(`Импортировано строк: ${result.importedCount}.`)}`);
  } catch (error) {
    redirect(`/skus?costImportError=${getErrorRedirectMessage(error, "Не удалось импортировать затраты из файла.")}`);
  }
}

export async function createWorkspaceInviteAction(formData: FormData) {
  const user = await requireCurrentSessionUserRole(UserRole.ADMIN);

  try {
    await createWorkspaceInvite({
      email: String(formData.get("email") ?? "").trim(),
      role: (String(formData.get("role") ?? UserRole.ANALYST).toUpperCase() as UserRole)
    }, {
      organizationId: user.organizationId,
      actorId: user.id
    });
  } catch (error) {
    redirect(`/settings?inviteError=${getErrorRedirectMessage(error, "Не удалось создать приглашение.")}`);
  }

  revalidateAppScreens();
  redirect("/settings");
}

export async function revokeWorkspaceInviteAction(inviteId: string) {
  const user = await requireCurrentSessionUserRole(UserRole.ADMIN);

  try {
    await revokeWorkspaceInvite(inviteId, {
      organizationId: user.organizationId,
      actorId: user.id
    });
  } catch (error) {
    redirect(`/settings?inviteError=${getErrorRedirectMessage(error, "Не удалось отозвать приглашение.")}`);
  }

  revalidateAppScreens();
  redirect("/settings");
}
