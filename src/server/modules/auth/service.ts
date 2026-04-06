import { UserRole } from "@prisma/client";

import { AppError } from "@/server/lib/errors";
import { prisma } from "@/server/lib/prisma";
import { acceptWorkspaceInviteByToken } from "@/server/modules/auth/invite.service";
import { ensureDemoWorkspace, ensureLiveWorkspace } from "@/server/modules/bootstrap/service";
import { env } from "@/server/lib/env";
import {
  DEMO_ACCOUNT_EMAIL,
  LIVE_OWNER_EMAIL,
  getWorkspaceKindBySlug,
  type WorkspaceKind
} from "@/server/modules/workspace/constants";

export const AUTH_COOKIE_NAME = "wb_copilot_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  workspaceKind: WorkspaceKind;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildDisplayName(email: string) {
  const localPart = email.split("@")[0] ?? "Пользователь";
  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export async function signInWithEmail(email: string, options?: { workspaceKind?: WorkspaceKind }) {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser) {
    return existingUser;
  }

  if (normalizedEmail === DEMO_ACCOUNT_EMAIL && env.authAllowDemoLogin) {
    const organization = await ensureDemoWorkspace();

    return prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        organizationId: organization.id,
        name: buildDisplayName(normalizedEmail),
        role: UserRole.ADMIN
      },
      create: {
        organizationId: organization.id,
        email: normalizedEmail,
        name: buildDisplayName(normalizedEmail),
        role: UserRole.ADMIN
      }
    });
  }

  if ([LIVE_OWNER_EMAIL, ...env.authBootstrapAdminEmails].includes(normalizedEmail) || options?.workspaceKind === "live") {
    const organization = await ensureLiveWorkspace();

    return prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        organizationId: organization.id,
        name: buildDisplayName(normalizedEmail),
        role: UserRole.ADMIN
      },
      create: {
        organizationId: organization.id,
        email: normalizedEmail,
        name: buildDisplayName(normalizedEmail),
        role: UserRole.ADMIN
      }
    });
  }

  const invite = await prisma.workspaceInvite.findFirst({
    where: {
      email: normalizedEmail,
      status: "PENDING"
    },
    orderBy: { createdAt: "desc" }
  });

  if (invite) {
    return acceptWorkspaceInviteByToken(invite.token);
  }

  throw new AppError(403, "invite_required", "Вход разрешён только пользователям с приглашением или существующим доступом.");
}

export async function getSessionUserById(userId: string | undefined | null): Promise<SessionUser | null> {
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: true
    }
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    organizationSlug: user.organization.slug,
    workspaceKind: getWorkspaceKindBySlug(user.organization.slug)
  };
}
