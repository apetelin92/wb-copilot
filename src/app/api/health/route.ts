import { prisma } from "@/server/lib/prisma";
import { withRouteHandler } from "@/server/lib/http";
import { getWorkspaceOperationalStatus } from "@/server/modules/ops-status/service";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteHandler(async () => {
    await prisma.$queryRaw`SELECT 1`;
    const organization = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" }
    });
    const ops = organization ? await getWorkspaceOperationalStatus({ organizationId: organization.id }) : null;

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "ok",
      workspace: organization?.slug ?? null,
      latestCompletedSyncAt: ops?.latestCompletedSync?.startedAt ?? null,
      syncFreshness: ops?.syncHealth.state ?? "never",
      incompleteSkuCount: ops?.incompleteSkuCount ?? 0
    };
  });
}
