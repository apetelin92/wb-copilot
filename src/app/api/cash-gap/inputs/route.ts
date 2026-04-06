import { withMutationHandler } from "@/server/lib/http";
import { cashInputsSchema, upsertCashInputs } from "@/server/modules/risk/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withMutationHandler(async () => {
    const payload = cashInputsSchema.parse(await request.json());
    return upsertCashInputs(payload);
  });
}
