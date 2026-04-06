import { withMutationHandler } from "@/server/lib/http";
import { createCostProfileSchema, upsertCostProfileAndRebuild } from "@/server/modules/costs/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: { skuId: string } }) {
  return withMutationHandler(async () => {
    const payload = createCostProfileSchema.parse(await request.json());
    return upsertCostProfileAndRebuild(context.params.skuId, payload);
  });
}
