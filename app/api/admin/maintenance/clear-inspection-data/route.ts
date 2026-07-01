import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function POST() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser(["ADMIN"]);
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const counts = await prisma.$transaction(async (tx) => {
      // Sequential deletes to respect FK constraints.
      // 1. Children with FKs to DailyInspection must go first (ActivityLog).
      //    InspectionResult is onDelete: Cascade from DailyInspection, but explicit delete is safer.
      const activityLogs     = await tx.activityLog.deleteMany({});
      const inspectionResults = await tx.inspectionResult.deleteMany({});
      const dailyInspections  = await tx.dailyInspection.deleteMany({});

      // 2. ServerDiskDetail is cascade from ServerMetricEntry; delete entry first.
      const serverMetricEntries = await tx.serverMetricEntry.deleteMany({});

      // 3. Remaining independent tables.
      const [serverMetricLogs, incidentLogs, dailyStatusEntries] = await Promise.all([
        tx.serverMetricLog.deleteMany({}),
        tx.incidentLog.deleteMany({}),
        tx.dailyStatusEntry.deleteMany({}),
      ]);

      return {
        activityLogs: activityLogs.count,
        inspectionResults: inspectionResults.count,
        dailyInspections: dailyInspections.count,
        serverMetricEntries: serverMetricEntries.count,
        serverMetricLogs: serverMetricLogs.count,
        incidentLogs: incidentLogs.count,
        dailyStatusEntries: dailyStatusEntries.count,
      };
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CLEAR_ALL_INSPECTION_DATA",
        entityType: "System",
        entityId: "maintenance",
        detail: {
          clearedBy: user.displayName,
          clearedAt: new Date().toISOString(),
          counts,
        },
      },
    });

    revalidatePath("/activity");
    revalidatePath("/reports");
    revalidatePath("/");
    revalidatePath("/checklist/history");

    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    console.error("[clear-inspection-data]", err);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: String(err) },
      { status: 500 }
    );
  }
}
