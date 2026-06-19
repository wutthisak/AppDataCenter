import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireUser(["ADMIN"]);
    const body = await request.json();
    const { name, location, description } = body;

    if (!name) {
      return NextResponse.json({ error: "name_required" }, { status: 400 });
    }

    const dataCenter = await prisma.dataCenter.update({
      where: { id: params.id },
      data: { name, location, description }
    });

    return NextResponse.json(dataCenter);
  } catch (error) {
    console.error("Error updating data center:", error);
    return NextResponse.json({ error: "Failed to update data center" }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireUser(["ADMIN"]);
    await prisma.dataCenter.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting data center:", error);
    return NextResponse.json({ error: "Failed to delete data center" }, { status: 500 });
  }
}
