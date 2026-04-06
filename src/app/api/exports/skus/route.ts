import { NextResponse } from "next/server";

import { listSkuProfitability } from "@/server/modules/sku/service";

export const dynamic = "force-dynamic";

function toCsvCell(value: string | number | boolean | null | undefined) {
  const stringValue = value == null ? "" : String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

export async function GET() {
  const { items: skus } = await listSkuProfitability({ profitability: "all" });
  const header = [
    "SKU",
    "WB NM ID",
    "Vendor code",
    "Net revenue RUB",
    "Contribution profit RUB",
    "Margin pct",
    "Sold units",
    "Returned units",
    "Incomplete costs"
  ];

  const rows = skus.map((sku) => [
    sku.title,
    sku.wbNmId,
    sku.vendorCode ?? "",
    sku.netRevenueRub,
    sku.contributionProfitRub,
    sku.marginPct,
    sku.soldUnits,
    sku.returnedUnits,
    sku.hasIncompleteCosts ? "yes" : "no"
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => toCsvCell(cell)).join(",")).join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wb-copilot-skus-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
