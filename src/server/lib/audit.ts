import { AuditActorType } from "@prisma/client";

import { toJsonValue } from "@/server/lib/json";
import { prisma } from "@/server/lib/prisma";

type AuditInput = {
  organizationId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType?: AuditActorType;
  actorId?: string;
  payload?: unknown;
};

export async function recordAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorType: input.actorType ?? AuditActorType.SYSTEM,
      actorId: input.actorId,
      payload: toJsonValue(input.payload)
    }
  });
}
