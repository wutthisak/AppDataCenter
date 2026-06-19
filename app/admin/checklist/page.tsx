import { AppShell } from "@/components/AppShell";
import { ChecklistAdmin } from "@/components/ChecklistAdmin";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function ChecklistAdminPage() {
  await requireUser(["ADMIN"]);
  const dataCenters = await prisma.dataCenter.findMany({
    where: { active: true },
    orderBy: { displayOrder: "asc" }
  });

  return (
    <AppShell title="จัดการ Checklist" subtitle="เพิ่ม แก้ไข และจัดการหมวดหมู่และรายการตรวจสอบตาม Data Center">
      <ChecklistAdmin initialDataCenters={dataCenters} />
    </AppShell>
  );
}
