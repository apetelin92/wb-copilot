import { SyncTrigger } from "@prisma/client";

import { assertJobSecret, withMutationHandler } from "@/server/lib/http";
import { env } from "@/server/lib/env";
import { AppError } from "@/server/lib/errors";
import { runWbSync } from "@/server/modules/wb/sync.service";

export const dynamic = "force-dynamic";

function getProvidedSecret(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const headerSecret = request.headers.get("x-job-secret");
  const querySecret = new URL(request.url).searchParams.get("secret");

  return bearer ?? headerSecret ?? querySecret;
}

export async function POST(request: Request) {
  return withMutationHandler(async () => {
    const providedSecret = getProvidedSecret(request);

    assertJobSecret(providedSecret);

    if (providedSecret !== env.dailySyncSecret) {
      throw new AppError(403, "invalid_job_secret", "Invalid job secret.");
    }

    return runWbSync({ trigger: SyncTrigger.SCHEDULED });
  });
}
