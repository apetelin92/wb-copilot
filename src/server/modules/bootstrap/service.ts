import { UserRole } from "@prisma/client";

import { prisma } from "@/server/lib/prisma";
import {
  DEMO_ACCOUNT_EMAIL,
  DEMO_ACCOUNT_NAME,
  DEMO_WORKSPACE_NAME,
  DEMO_WORKSPACE_SLUG,
  LIVE_OWNER_EMAIL,
  LIVE_OWNER_NAME,
  LIVE_WORKSPACE_NAME,
  LIVE_WORKSPACE_SLUG
} from "@/server/modules/workspace/constants";

async function ensureWorkspace(input: { slug: string; name: string; ownerEmail: string; ownerName: string }) {
  const organization = await prisma.organization.upsert({
    where: { slug: input.slug },
    update: {
      name: input.name
    },
    create: {
      slug: input.slug,
      name: input.name
    }
  });

  await prisma.user.upsert({
    where: { email: input.ownerEmail },
    update: {
      organizationId: organization.id,
      name: input.ownerName,
      role: UserRole.ADMIN
    },
    create: {
      organizationId: organization.id,
      email: input.ownerEmail,
      name: input.ownerName,
      role: UserRole.ADMIN
    }
  });

  return organization;
}

export async function ensureLiveWorkspace() {
  return ensureWorkspace({
    slug: LIVE_WORKSPACE_SLUG,
    name: LIVE_WORKSPACE_NAME,
    ownerEmail: LIVE_OWNER_EMAIL,
    ownerName: LIVE_OWNER_NAME
  });
}

export async function ensureDemoWorkspace() {
  return ensureWorkspace({
    slug: DEMO_WORKSPACE_SLUG,
    name: DEMO_WORKSPACE_NAME,
    ownerEmail: DEMO_ACCOUNT_EMAIL,
    ownerName: DEMO_ACCOUNT_NAME
  });
}

export async function ensureDefaultWorkspace() {
  return ensureLiveWorkspace();
}
