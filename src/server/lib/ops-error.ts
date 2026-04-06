import { randomUUID } from "crypto";

import { recordAuditLog } from "@/server/lib/audit";
import { env } from "@/server/lib/env";

type OperationalErrorInput = {
  organizationId?: string | null;
  scope: string;
  message: string;
  details?: unknown;
};

export async function recordOperationalError(input: OperationalErrorInput) {
  if (input.organizationId) {
    await recordAuditLog({
      organizationId: input.organizationId,
      entityType: "OperationalError",
      entityId: randomUUID(),
      action: input.scope,
      payload: {
        message: input.message,
        details: input.details ?? null
      }
    });
  }

  if (env.errorTrackingWebhookUrl) {
    await fetch(env.errorTrackingWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: input.scope,
        organizationId: input.organizationId ?? null,
        message: input.message,
        details: input.details ?? null,
        timestamp: new Date().toISOString()
      }),
      cache: "no-store"
    }).catch(() => null);
  }
}
