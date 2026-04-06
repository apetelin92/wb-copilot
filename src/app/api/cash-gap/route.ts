import { z } from "zod";

import { withRouteHandler } from "@/server/lib/http";
import { getCashGapView, projectCashGap } from "@/server/modules/risk/service";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  asOfDate: z.string().optional()
});

export async function GET(request: Request) {
  return withRouteHandler(async () => {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({ asOfDate: searchParams.get("asOfDate") ?? undefined });
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : undefined;
    const existing = await getCashGapView(asOfDate);

    if (existing) {
      return existing;
    }

    const organization = await resolveOrganizationContext();
    return projectCashGap({ organizationId: organization.id, asOfDate: asOfDate ?? new Date(), windowDays: 14 });
  });
}
