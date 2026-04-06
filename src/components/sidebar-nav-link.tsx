"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SidebarNavLink({
  href,
  label,
  badge,
  secondary = false
}: {
  href: string;
  label: string;
  badge?: string;
  secondary?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  return (
    <Link className={`sidebar__link ${isActive ? "sidebar__link--active" : ""} ${secondary ? "sidebar__link--secondary" : ""}`} href={href}>
      <span className="sidebar__link-content">
        <span>{label}</span>
        {badge ? <span className="sidebar__link-badge">{badge}</span> : null}
      </span>
    </Link>
  );
}
