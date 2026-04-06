import { withMutationHandler } from "@/server/lib/http";
import { ensureDemoWorkspaceReady } from "@/server/modules/demo/service";

export const dynamic = "force-dynamic";

export async function POST() {
  return withMutationHandler(async () => ensureDemoWorkspaceReady());
}
