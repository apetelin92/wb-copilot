import { NextResponse } from "next/server";

import { listCostProfilesTemplateForExport } from "@/server/modules/costs/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const csv = await listCostProfilesTemplateForExport();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wb-copilot-cost-profiles-template-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
