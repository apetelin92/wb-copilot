export type WorkspaceKind = "demo" | "live";

export const LIVE_WORKSPACE_SLUG = "live-workspace";
export const LIVE_WORKSPACE_NAME = "Рабочий кабинет";
export const LIVE_OWNER_EMAIL = "owner@local.test";
export const LIVE_OWNER_NAME = "Владелец кабинета";

export const DEMO_WORKSPACE_SLUG = "demo-workspace";
export const DEMO_WORKSPACE_NAME = "Демо кабинет";
export const DEMO_ACCOUNT_EMAIL = "demo@local.test";
export const DEMO_ACCOUNT_NAME = "Владелец демо-кабинета";

export function getWorkspaceKindBySlug(slug: string): WorkspaceKind {
  return slug === DEMO_WORKSPACE_SLUG ? "demo" : "live";
}
