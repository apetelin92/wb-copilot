import crypto from "crypto";

import { UserRole, WorkspaceInviteStatus, type WorkspaceInvite } from "@prisma/client";
import { z } from "zod";

import { recordAuditLog } from "@/server/lib/audit";
import { AppError } from "@/server/lib/errors";
import { env } from "@/server/lib/env";
import { prisma } from "@/server/lib/prisma";

const createInviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.nativeEnum(UserRole)
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getInviteExpiryDate() {
  return new Date(Date.now() + env.inviteTtlHours * 60 * 60 * 1000);
}

function createInviteToken() {
  return crypto.randomBytes(24).toString("hex");
}

function isInviteExpired(invite: Pick<WorkspaceInvite, "expiresAt" | "status">) {
  return invite.status === WorkspaceInviteStatus.EXPIRED || Boolean(invite.expiresAt && invite.expiresAt.getTime() <= Date.now());
}

export async function listWorkspaceInvites(organizationId: string) {
  return prisma.workspaceInvite.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "desc" }],
    take: 20
  });
}

export async function createWorkspaceInvite(input: z.infer<typeof createInviteSchema>, context: { organizationId: string; actorId: string }) {
  const payload = createInviteSchema.parse(input);
  const email = normalizeEmail(payload.email);
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser?.organizationId === context.organizationId) {
    throw new AppError(409, "user_already_exists", "Пользователь уже добавлен в это рабочее пространство.");
  }

  const invite = await prisma.workspaceInvite.create({
    data: {
      organizationId: context.organizationId,
      email,
      role: payload.role,
      token: createInviteToken(),
      status: WorkspaceInviteStatus.PENDING,
      invitedByUserId: context.actorId,
      expiresAt: getInviteExpiryDate()
    }
  });

  await recordAuditLog({
    organizationId: context.organizationId,
    entityType: "WorkspaceInvite",
    entityId: invite.id,
    action: "created",
    actorId: context.actorId,
    payload: {
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt?.toISOString() ?? null
    }
  });

  return invite;
}

export async function revokeWorkspaceInvite(inviteId: string, context: { organizationId: string; actorId: string }) {
  const invite = await prisma.workspaceInvite.findFirst({
    where: {
      id: inviteId,
      organizationId: context.organizationId
    }
  });

  if (!invite) {
    throw new AppError(404, "invite_not_found", "Приглашение не найдено.");
  }

  const updated = await prisma.workspaceInvite.update({
    where: { id: invite.id },
    data: { status: WorkspaceInviteStatus.REVOKED }
  });

  await recordAuditLog({
    organizationId: context.organizationId,
    entityType: "WorkspaceInvite",
    entityId: invite.id,
    action: "revoked",
    actorId: context.actorId,
    payload: { email: invite.email }
  });

  return updated;
}

export async function getInvitePreviewByToken(token: string) {
  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    include: { organization: true }
  });

  if (!invite) {
    return null;
  }

  const expired = isInviteExpired(invite);

  return {
    id: invite.id,
    token: invite.token,
    email: invite.email,
    role: invite.role,
    status: expired ? WorkspaceInviteStatus.EXPIRED : invite.status,
    expiresAt: invite.expiresAt,
    organizationName: invite.organization.name
  };
}

export async function acceptWorkspaceInviteByToken(token: string) {
  const invite = await prisma.workspaceInvite.findUnique({ where: { token } });

  if (!invite) {
    throw new AppError(404, "invite_not_found", "Приглашение не найдено.");
  }

  if (invite.status !== WorkspaceInviteStatus.PENDING || isInviteExpired(invite)) {
    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { status: WorkspaceInviteStatus.EXPIRED }
    }).catch(() => null);

    throw new AppError(409, "invite_not_active", "Приглашение уже недействительно или было использовано.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });

  if (existingUser && existingUser.organizationId !== invite.organizationId) {
    throw new AppError(409, "invite_workspace_conflict", "Эта почта уже используется в другом рабочем пространстве.");
  }

  const user = existingUser
    ? existingUser
    : await prisma.user.create({
        data: {
          organizationId: invite.organizationId,
          email: invite.email,
          name: invite.email.split("@")[0] ?? "Аналитик",
          role: invite.role
        }
      });

  await prisma.workspaceInvite.update({
    where: { id: invite.id },
    data: {
      status: WorkspaceInviteStatus.ACCEPTED,
      acceptedAt: new Date(),
      acceptedUserId: user.id
    }
  });

  await recordAuditLog({
    organizationId: invite.organizationId,
    entityType: "WorkspaceInvite",
    entityId: invite.id,
    action: "accepted",
    actorId: user.id,
    payload: { email: invite.email, role: invite.role }
  });

  return user;
}
