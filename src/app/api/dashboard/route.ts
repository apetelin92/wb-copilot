import { z } from "zod";

import { withRouteHandler } from "@/server/lib/http";
import { getDashboardData } from "@/server/modules/dashboard/service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  asOfDate: z.string().optional()
});

export async function GET(request: Request) {
  return withRouteHandler(async () => {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({ asOfDate: searchParams.get("asOfDate") ?? undefined });

    return getDashboardData(query.asOfDate ? new Date(query.asOfDate) : undefined);
  });
}
