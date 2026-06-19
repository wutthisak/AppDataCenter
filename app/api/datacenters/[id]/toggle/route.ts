import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireUser(["ADMIN"]);

    const dataCenter = await prisma.dataCenter.findUnique({ where: { id: params.id } });
    if (!dataCenter) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const updated = await prisma.dataCenter.update({
      where: { id: params.id },
      data: { active: !dataCenter.active }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error toggling data center:", error);
    return NextResponse.json({ error: "Failed to toggle data center" }, { status: 500 });
  }
}
