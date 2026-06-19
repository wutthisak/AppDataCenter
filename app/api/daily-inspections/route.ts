import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const dataCenterId = searchParams.get("dataCenterId");
    const date = searchParams.get("date");

    if (!dataCenterId || !date) {
      return NextResponse.json({ error: "dataCenterId and date required" }, { status: 400 });
    }

    const inspection = await prisma.dailyInspection.findFirst({
      where: {
        dataCenterId,
        inspectionDate: new Date(date)
      },
      orderBy: { timeSlot: "desc" },
      include: {
        results: {
          include: {
            checklistItem: true
          }
        }
      }
    });

    if (!inspection) {
      return NextResponse.json(null);
    }

    const results = inspection.results.reduce((acc, result) => {
      acc[result.checklistItemId] = {
        status: result.status,
        temperature: result.temperature?.toString() || "",
        humidity: result.humidity?.toString() || "",
        note: result.note || ""
      };
      return acc;
    }, {} as Record<string, { status: string; temperature: string; humidity: string; note: string }>);

    return NextResponse.json({
      inspection,
      results
    });
  } catch (error) {
    console.error("Error fetching daily inspection:", error);
    return NextResponse.json({ error: "Failed to fetch daily inspection" }, { status: 500 });
  }
}
