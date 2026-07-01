import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { inspectionShiftOrder, inspectionTimeSlotOrder, shiftDefaultSlots } from "@/lib/inspection-shifts";

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const dataCenterId = searchParams.get("dataCenterId");
    const date = searchParams.get("date");
    const shiftParam = searchParams.get("inspectionShift");
    const inspectionShift = inspectionShiftOrder.includes(shiftParam as any)
      ? (shiftParam as (typeof inspectionShiftOrder)[number])
      : null;
    const timeSlotParam = searchParams.get("timeSlot");
    const timeSlot = inspectionTimeSlotOrder.includes(timeSlotParam as any)
      ? (timeSlotParam as (typeof inspectionTimeSlotOrder)[number])
      : null;

    if (!dataCenterId || !date) {
      return NextResponse.json({ error: "dataCenterId and date required" }, { status: 400 });
    }

    const inspectedRecords = await prisma.dailyInspection.findMany({
      where: {
        dataCenterId,
        inspectionDate: new Date(date),
        ...(inspectionShift ? { inspectionShift } : {})
      },
      select: { timeSlot: true }
    });
    const inspectedSlots = inspectedRecords.map((item) => item.timeSlot);

    const inspection = await prisma.dailyInspection.findFirst({
      where: {
        dataCenterId,
        inspectionDate: new Date(date),
        ...(inspectionShift ? { inspectionShift } : {}),
        ...(timeSlot ? { timeSlot } : {})
      },
      orderBy: [{ updatedAt: "desc" }, { timeSlot: "desc" }],
      include: {
        results: {
          include: {
            checklistItem: true
          }
        }
      }
    });

    const results = inspection
      ? inspection.results.reduce((acc, result) => {
          acc[result.checklistItemId] = {
            status: result.status,
            temperature: result.temperature?.toString() || "",
            humidity: result.humidity?.toString() || "",
            note: result.note || ""
          };
          return acc;
        }, {} as Record<string, { status: string; temperature: string; humidity: string; note: string }>)
      : {};

    const totalSlots = inspectionShift ? (shiftDefaultSlots[inspectionShift]?.length ?? 0) : inspectedSlots.length;

    return NextResponse.json({
      inspection,
      results,
      inspectedSlots,
      inspectedCount: inspectedSlots.length,
      totalSlots
    });
  } catch (error) {
    console.error("Error fetching daily inspection:", error);
    return NextResponse.json({ error: "Failed to fetch daily inspection" }, { status: 500 });
  }
}
