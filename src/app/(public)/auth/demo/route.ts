import { NextResponse } from "next/server";

import { env } from "@/server/lib/env";
import { AUTH_COOKIE_NAME, signInWithEmail } from "@/server/modules/auth/service";
import { ensureDemoWorkspaceReady } from "@/server/modules/demo/service";
import { DEMO_ACCOUNT_EMAIL } from "@/server/modules/workspace/constants";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!env.authAllowDemoLogin) {
    return new NextResponse(null, {
      status: 303,
      headers: {
        Location: "/auth?error=demo_disabled"
      }
    });
  }

  await ensureDemoWorkspaceReady();
  const user = await signInWithEmail(DEMO_ACCOUNT_EMAIL, { workspaceKind: "demo" });

  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/dashboard"
    }
  });
  response.cookies.set(AUTH_COOKIE_NAME, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });

  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
