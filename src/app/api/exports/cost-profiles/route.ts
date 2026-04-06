import { NextResponse } from "next/server";

import { listLatestCostProfilesForExport } from "@/server/modules/costs/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const csv = await listLatestCostProfilesForExport();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wb-copilot-cost-profiles-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
