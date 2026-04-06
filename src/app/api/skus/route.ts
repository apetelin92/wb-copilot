import { z } from "zod";

import { withRouteHandler } from "@/server/lib/http";
import { listSkuProfitability } from "@/server/modules/sku/service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  asOfDate: z.string().optional(),
  profitability: z.enum(["attention", "all", "positive", "loss", "incomplete", "at_risk"]).optional()
});

export async function GET(request: Request) {
  return withRouteHandler(async () => {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      asOfDate: searchParams.get("asOfDate") ?? undefined,
      profitability: searchParams.get("profitability") ?? undefined
    });

    return listSkuProfitability({
      asOfDate: query.asOfDate ? new Date(query.asOfDate) : undefined,
      profitability: query.profitability
    });
  });
}
