import { SyncRunStatus } from "@prisma/client";

import { prisma } from "@/server/lib/prisma";
import { env } from "@/server/lib/env";
import { startOfUtcDay } from "@/server/lib/date";
import { buildSyncFreshnessStatus, humanizeSyncErrorMessage } from "@/server/modules/ops-status/helpers";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";

export type SyncFreshnessState = "fresh" | "stale" | "failed" | "never";

export async function getWorkspaceOperationalStatus(options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const today = startOfUtcDay(new Date());
  const [latestSync, latestCompletedSync, incompleteSkuCount] = await Promise.all([
    prisma.syncRun.findFirst({
      where: { organizationId: organization.id },
      orderBy: { startedAt: "desc" }
    }),
    prisma.syncRun.findFirst({
      where: { organizationId: organization.id, status: SyncRunStatus.COMPLETED },
      orderBy: { startedAt: "desc" }
    }),
    prisma.dailySkuMetric.count({
      where: {
        organizationId: organization.id,
        metricDate: today,
        hasIncompleteCosts: true
      }
    })
  ]);

  return {
    latestSync,
    latestCompletedSync,
    incompleteSkuCount,
    syncHealth: buildSyncFreshnessStatus({
      latestCompletedAt: latestCompletedSync?.startedAt,
      latestSyncStatus: latestSync?.status,
      latestSyncStartedAt: latestSync?.startedAt,
      latestFailureMessage: latestSync?.errorMessage,
      staleAfterHours: env.syncStaleAfterHours
    })
  };
}

export { buildSyncFreshnessStatus, humanizeSyncErrorMessage };
