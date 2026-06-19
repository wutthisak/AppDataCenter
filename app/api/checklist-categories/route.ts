import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const dataCenterId = searchParams.get("dataCenterId");

    if (!dataCenterId) {
      return NextResponse.json({ error: "dataCenterId required" }, { status: 400 });
    }

    const categories = await prisma.checklistCategory.findMany({
      where: { dataCenterId },
      orderBy: { displayOrder: "asc" },
      include: { items: { orderBy: { displayOrder: "asc" } } }
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching checklist categories:", error);
    return NextResponse.json({ error: "Failed to fetch checklist categories" }, { status: 500 });
  }
}
