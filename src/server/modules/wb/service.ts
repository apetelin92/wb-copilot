import { WbConnectionStatus } from "@prisma/client";
import { z } from "zod";

import { recordAuditLog } from "@/server/lib/audit";
import { decryptText, encryptText } from "@/server/lib/crypto";
import { env } from "@/server/lib/env";
import { AppError } from "@/server/lib/errors";
import { prisma } from "@/server/lib/prisma";
import { createWbAdapter } from "@/server/modules/wb/adapter";
import type { WbCredentials } from "@/server/modules/wb/types";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";

export const connectWbSchema = z.object({
  name: z.string().trim().min(2),
  apiToken: z.string().trim().min(8),
  cabinetId: z.string().trim().optional()
});

function toPublicConnection(connection: {
  id: string;
  name: string;
  cabinetId: string | null;
  status: WbConnectionStatus;
  lastVerifiedAt: Date | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: connection.id,
    name: connection.name,
    cabinetId: connection.cabinetId,
    status: connection.status,
    lastVerifiedAt: connection.lastVerifiedAt,
    lastSyncAt: connection.lastSyncAt,
    lastError: connection.lastError,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt
  };
}

export async function getWbConnection(options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const connection = await prisma.wBConnection.findFirst({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "asc" }
  });

  return connection ? toPublicConnection(connection) : null;
}

export async function connectWbAccount(input: z.infer<typeof connectWbSchema>, options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const credentials = connectWbSchema.parse(input);
  const adapter = createWbAdapter({ workspaceKind: organization.workspaceKind });
  const verification = await adapter.verifyConnection(credentials);

  const encryptedToken = encryptText(credentials.apiToken, env.appEncryptionKey);
  const existing = await prisma.wBConnection.findFirst({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "asc" }
  });

  const connection = existing
    ? await prisma.wBConnection.update({
        where: { id: existing.id },
        data: {
          name: verification.accountName,
          cabinetId: verification.cabinetId,
          apiTokenEncrypted: encryptedToken,
          status: WbConnectionStatus.CONNECTED,
          lastVerifiedAt: new Date(),
          lastError: null
        }
      })
    : await prisma.wBConnection.create({
        data: {
          organizationId: organization.id,
          name: verification.accountName,
          cabinetId: verification.cabinetId,
          apiTokenEncrypted: encryptedToken,
          status: WbConnectionStatus.CONNECTED,
          lastVerifiedAt: new Date()
        }
      });

  await recordAuditLog({
    organizationId: organization.id,
    entityType: "WBConnection",
    entityId: connection.id,
    action: existing ? "updated" : "created",
    payload: {
      cabinetId: connection.cabinetId,
      status: connection.status
    }
  });

  return toPublicConnection(connection);
}

export async function getSyncCredentials(options?: { organizationId?: string }): Promise<{
  organizationId: string;
  connectionId: string;
  credentials: WbCredentials;
  workspaceKind: "demo" | "live";
}> {
  const organization = await resolveOrganizationContext(options);
  const connection = await prisma.wBConnection.findFirst({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "asc" }
  });

  if (!connection) {
    throw new AppError(400, "wb_connection_missing", "Connect a WB account before running sync.");
  }

  if (connection.status !== WbConnectionStatus.CONNECTED) {
    throw new AppError(409, "wb_connection_not_ready", "WB connection is not in a connected state.");
  }

  return {
    organizationId: organization.id,
    connectionId: connection.id,
    workspaceKind: organization.workspaceKind,
    credentials: {
      name: connection.name,
      cabinetId: connection.cabinetId ?? undefined,
      apiToken: decryptText(connection.apiTokenEncrypted, env.appEncryptionKey)
    }
  };
}

export async function markConnectionSyncState(connectionId: string, input: { lastSyncAt?: Date; lastError?: string | null; status?: WbConnectionStatus }) {
  await prisma.wBConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncAt: input.lastSyncAt,
      lastError: input.lastError,
      status: input.status
    }
  });
}
