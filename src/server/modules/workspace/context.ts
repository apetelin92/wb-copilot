import { AppError } from "@/server/lib/errors";
import { prisma } from "@/server/lib/prisma";
import { getCurrentSessionUser } from "@/server/modules/auth/session";
import { ensureDemoWorkspace, ensureLiveWorkspace } from "@/server/modules/bootstrap/service";
import { getWorkspaceKindBySlug, type WorkspaceKind } from "@/server/modules/workspace/constants";

export type OrganizationContext = {
  id: string;
  slug: string;
  name: string;
  workspaceKind: WorkspaceKind;
};

export type ResolveOrganizationContextOptions = {
  organizationId?: string;
  fallback?: WorkspaceKind;
};

export async function resolveOrganizationContext(options?: ResolveOrganizationContextOptions): Promise<OrganizationContext> {
  if (options?.organizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: options.organizationId }
    });

    if (!organization) {
      throw new AppError(404, "organization_not_found", "Organization not found.");
    }

    return {
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
      workspaceKind: getWorkspaceKindBySlug(organization.slug)
    };
  }

  const user = await getCurrentSessionUser();
  if (user) {
    return {
      id: user.organizationId,
      slug: user.organizationSlug,
      name: user.organizationName,
      workspaceKind: user.workspaceKind
    };
  }

  if (!options?.fallback) {
    throw new AppError(401, "unauthorized", "Authentication is required.");
  }

  const fallbackOrganization = options?.fallback === "demo" ? await ensureDemoWorkspace() : await ensureLiveWorkspace();

  return {
    id: fallbackOrganization.id,
    slug: fallbackOrganization.slug,
    name: fallbackOrganization.name,
    workspaceKind: getWorkspaceKindBySlug(fallbackOrganization.slug)
  };
}
