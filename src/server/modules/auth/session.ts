import { cookies } from "next/headers";
import { UserRole } from "@prisma/client";

import { AppError } from "@/server/lib/errors";
import { AUTH_COOKIE_NAME, getSessionUserById } from "@/server/modules/auth/service";

export async function getCurrentSessionUser() {
  const userId = cookies().get(AUTH_COOKIE_NAME)?.value;
  return getSessionUserById(userId);
}

export async function requireCurrentSessionUser() {
  const user = await getCurrentSessionUser();

  if (!user) {
    throw new AppError(401, "unauthorized", "Authentication is required.");
  }

  return user;
}

export async function requireCurrentSessionUserRole(role: UserRole | UserRole[]) {
  const user = await requireCurrentSessionUser();
  const roles = Array.isArray(role) ? role : [role];

  if (!roles.includes(user.role)) {
    throw new AppError(403, "forbidden", "You do not have access to perform this action.");
  }

  return user;
}
