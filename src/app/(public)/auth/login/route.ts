import { NextResponse } from "next/server";

import { AppError } from "@/server/lib/errors";
import { AUTH_COOKIE_NAME, signInWithEmail } from "@/server/modules/auth/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return new NextResponse(null, {
      status: 303,
      headers: {
        Location: "/auth?error=missing_email"
      }
    });
  }

  let user;

  try {
    user = await signInWithEmail(email);
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Не удалось выполнить вход.";

    return new NextResponse(null, {
      status: 303,
      headers: {
        Location: `/auth?error=${encodeURIComponent(message)}`
      }
    });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/"
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
