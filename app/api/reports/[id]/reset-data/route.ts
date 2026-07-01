import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(["ADMIN"]);
  const { id: reportId } = await params;

  const report = await prisma.monthlyReport.findUnique({
    where: { id: reportId },
    select: { id: true, month: true, buddhistYear: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const { month, buddhistYear } = report;
  const gregYear = buddhistYear - 543;
  const startDate = new Date(gregYear, month - 1, 1);
  const endDate   = new Date(gregYear, month,     0, 23, 59, 59, 999);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. ActivityLog (linked via DailyInspection.inspectionDate)
      const dailyInspIds = await tx.dailyInspection.findMany({
        where: { inspectionDate: { gte: startDate, lte: endDate } },
        select: { id: true },
      });
      const diIds = dailyInspIds.map((d) => d.id);

      if (diIds.length > 0) {
        await tx.activityLog.deleteMany({ where: { dailyInspectionId: { in: diIds } } });
        await tx.inspectionResult.deleteMany({ where: { dailyInspectionId: { in: diIds } } });
        await tx.dailyInspection.deleteMany({ where: { id: { in: diIds } } });
      }

      // 2. Server Metric Entries (ServerDiskDetail cascade via Prisma relation)
      const metricIds = await tx.serverMetricEntry.findMany({
        where: { recordDate: { gte: startDate, lte: endDate } },
        select: { id: true },
      });
      const mIds = metricIds.map((m) => m.id);
      if (mIds.length > 0) {
        await tx.serverDiskDetail.deleteMany({ where: { metricEntryId: { in: mIds } } });
        await tx.serverMetricEntry.deleteMany({ where: { id: { in: mIds } } });
      }

      // 3. Daily Status Entries + ServerMetricLog + IncidentLog linked to report
      await tx.dailyStatusEntry.deleteMany({ where: { reportId } });
      await tx.serverMetricLog.deleteMany({ where: { reportId } });
      await tx.incidentLog.deleteMany({ where: { reportId } });

      // 4. Audit log (before deleting the report row)
      await tx.auditLog.create({
        data: {
          userId:     user.id,
          action:     "DELETE_REPORT_DATA",
          entityType: "MonthlyReport",
          entityId:   reportId,
          detail: { month, buddhistYear },
        },
      });

      // 5. Delete MonthlyReport record — card disappears from list
      await tx.monthlyReport.delete({ where: { id: reportId } });
    }, { timeout: 30000 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-data]", err);
    return NextResponse.json(
      { error: "Reset failed", detail: String(err) },
      { status: 500 }
    );
  }
}
