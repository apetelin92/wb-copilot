import { z } from "zod";

import { withRouteHandler } from "@/server/lib/http";
import { getSkuDetail } from "@/server/modules/sku/service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  asOfDate: z.string().optional(),
  days: z.coerce.number().int().min(1).max(180).optional()
});

export async function GET(request: Request, context: { params: { skuId: string } }) {
  return withRouteHandler(async () => {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      asOfDate: searchParams.get("asOfDate") ?? undefined,
      days: searchParams.get("days") ?? undefined
    });

    return getSkuDetail(context.params.skuId, {
      asOfDate: query.asOfDate ? new Date(query.asOfDate) : undefined,
      days: query.days
    });
  });
}
