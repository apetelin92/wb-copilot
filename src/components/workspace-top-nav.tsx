"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Сегодня" },
  { href: "/skus", label: "SKU" },
  { href: "/cash-gap", label: "Касса" },
  { href: "/calculator", label: "Калькулятор" },
  { href: "/brief", label: "Бриф" }
];

export function WorkspaceTopNav() {
  const pathname = usePathname();

  return (
    <div className="workspace-top-nav" aria-label="Разделы продукта">
      {items.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

        return (
          <Link className={`workspace-top-nav__link ${isActive ? "workspace-top-nav__link--active" : ""}`} href={item.href} key={item.href}>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
