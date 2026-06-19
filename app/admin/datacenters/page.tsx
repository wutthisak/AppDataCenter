import { AppShell } from "@/components/AppShell";
import { DataCentersTable } from "@/components/DataCentersTable";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function DataCentersAdminPage() {
  await requireUser(["ADMIN"]);
  const dataCenters = await prisma.dataCenter.findMany({
    orderBy: { displayOrder: "asc" }
  });

  return (
    <AppShell title="จัดการ Data Center" subtitle="เพิ่ม แก้ไข และจัดการห้อง Data Center">
      <DataCentersTable initialDataCenters={dataCenters} />
    </AppShell>
  );
}
