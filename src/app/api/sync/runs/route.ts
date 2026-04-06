import { withRouteHandler } from "@/server/lib/http";
import { listSyncRuns } from "@/server/modules/wb/sync.service";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteHandler(async () => listSyncRuns());
}
