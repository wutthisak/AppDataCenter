import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    await requireUser(["ADMIN"]);
    const dataCenters = await prisma.dataCenter.findMany({
      orderBy: { displayOrder: "asc" }
    });
    return NextResponse.json(dataCenters);
  } catch (error) {
    console.error("Error fetching data centers:", error);
    return NextResponse.json({ error: "Failed to fetch data centers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(["ADMIN"]);
    const body = await request.json();
    const { name, location, description } = body;

    if (!name) {
      return NextResponse.json({ error: "name_required" }, { status: 400 });
    }

    const maxOrder = await prisma.dataCenter.findFirst({
      where: { active: true },
      orderBy: { displayOrder: "desc" }
    });

    const dataCenter = await prisma.dataCenter.create({
      data: {
        name,
        location,
        description,
        displayOrder: (maxOrder?.displayOrder ?? 0) + 1
      }
    });

    return NextResponse.json(dataCenter);
  } catch (error) {
    console.error("Error creating data center:", error);
    return NextResponse.json({ error: "Failed to create data center" }, { status: 500 });
  }
}
