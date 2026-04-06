import { withMutationHandler } from "@/server/lib/http";
import { runSyncSchema, runWbSync } from "@/server/modules/wb/sync.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withMutationHandler(async () => {
    const body = await request.json().catch(() => ({}));
    const payload = runSyncSchema.parse(body);
    return runWbSync(payload);
  });
}
