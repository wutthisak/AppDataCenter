import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  buildDashboardCsv,
  dashboardExportFilename,
  getDashboardData,
  parseDashboardFilters
} from "@/lib/dashboard";

export async function GET(request: Request) {
  await requireUser();

  const { searchParams } = new URL(request.url);
  const filters = parseDashboardFilters(searchParams);
  const data = await getDashboardData(filters);
  const csv = buildDashboardCsv(data.rawRows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dashboardExportFilename(filters)}"`,
      "Cache-Control": "no-store"
    }
  });
}
