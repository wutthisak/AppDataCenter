"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export type PolicyFormData = {
  id?: string;
  categoryKey: string;
  categoryLabel: string;
  minRoundsPerDay: number;
  requiredShifts: string;
  active: boolean;
  note?: string;
  displayOrder: number;
};

export async function upsertPolicy(data: PolicyFormData) {
  await requireUser(["ADMIN"]);

  if (!data.categoryKey.trim() || !data.categoryLabel.trim()) {
    return { error: "กรุณากรอก Category Key และ Label" };
  }
  if (data.minRoundsPerDay < 1 || data.minRoundsPerDay > 24) {
    return { error: "จำนวนรอบขั้นต่ำต้องอยู่ระหว่าง 1–24" };
  }

  const db = prisma as any;
  try {
    if (data.id) {
      await db.inspectionPolicy.update({
        where: { id: data.id },
        data: {
          categoryLabel:   data.categoryLabel.trim(),
          minRoundsPerDay: data.minRoundsPerDay,
          requiredShifts:  data.requiredShifts,
          active:          data.active,
          note:            data.note?.trim() || null,
          displayOrder:    data.displayOrder
        }
      });
    } else {
      const existing = await db.inspectionPolicy.findUnique({
        where: { categoryKey: data.categoryKey.trim().toUpperCase() }
      });
      if (existing) return { error: `Category Key "${data.categoryKey}" มีอยู่แล้ว` };

      await db.inspectionPolicy.create({
        data: {
          categoryKey:     data.categoryKey.trim().toUpperCase(),
          categoryLabel:   data.categoryLabel.trim(),
          minRoundsPerDay: data.minRoundsPerDay,
          requiredShifts:  data.requiredShifts,
          active:          data.active,
          note:            data.note?.trim() || null,
          displayOrder:    data.displayOrder
        }
      });
    }
    revalidatePath("/admin/inspection-policy");
    return { success: true };
  } catch {
    return { error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }
}

export async function togglePolicy(id: string, active: boolean) {
  await requireUser(["ADMIN"]);
  await (prisma as any).inspectionPolicy.update({ where: { id }, data: { active } });
  revalidatePath("/admin/inspection-policy");
  return { success: true };
}
