import { withMutationHandler, withRouteHandler } from "@/server/lib/http";
import { connectWbAccount, connectWbSchema, getWbConnection } from "@/server/modules/wb/service";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteHandler(async () => getWbConnection());
}

export async function POST(request: Request) {
  return withMutationHandler(async () => {
    const payload = connectWbSchema.parse(await request.json());
    return connectWbAccount(payload);
  });
}
