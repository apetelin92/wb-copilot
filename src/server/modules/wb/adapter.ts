import { env } from "@/server/lib/env";

import { HttpWbAdapter } from "@/server/modules/wb/http-adapter";
import { MockWbAdapter } from "@/server/modules/wb/mock-adapter";
import type { WorkspaceKind } from "@/server/modules/workspace/constants";

export function createWbAdapter(input?: { workspaceKind?: WorkspaceKind }) {
  if (input?.workspaceKind === "demo") {
    return new MockWbAdapter();
  }

  if (input?.workspaceKind === "live") {
    return env.wbApiBaseUrl ? new HttpWbAdapter(env.wbApiBaseUrl) : new HttpWbAdapter();
  }

  if (env.wbUseMock) {
    return new MockWbAdapter();
  }

  if (env.wbApiBaseUrl) {
    return new HttpWbAdapter(env.wbApiBaseUrl);
  }

  return new HttpWbAdapter();
}
