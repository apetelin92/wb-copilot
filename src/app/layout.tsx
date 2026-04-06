import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import type { ReactNode } from "react";

import "@/app/globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans"
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "MarginPoint — сервис, который показывает, где seller теряет прибыль на маркетплейсах",
  description:
    "MarginPoint помогает seller-командам видеть убыточные SKU, слабую маржу, риск кассового разрыва и ежедневные приоритеты. Первый пилот сфокусирован на WB.",
  openGraph: {
    title: "MarginPoint — где теряется прибыль, какие SKU тянут вниз маржу и что делать сегодня",
    description:
      "Ежедневный ассистент по прибыли, SKU и кассе для marketplace-команд. Решения, а не просто цифры.",
    type: "website",
    locale: "ru_RU"
  },
  twitter: {
    card: "summary_large_image",
    title: "MarginPoint — ежедневный ассистент по прибыли для marketplace-команд",
    description:
      "Видно, где теряется прибыль, какие SKU тянут вниз маржу и есть ли риск кассового разрыва."
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${unbounded.variable}`}>{children}</body>
    </html>
  );
}
