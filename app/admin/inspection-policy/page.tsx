import { AppShell } from "@/components/AppShell";
import { InspectionPolicyAdmin } from "@/components/InspectionPolicyAdmin";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function InspectionPolicyPage() {
  await requireUser(["ADMIN"]);

  const policies = await (prisma as any).inspectionPolicy.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
  });

  return (
    <AppShell title="Inspection Policy" subtitle="นโยบายการตรวจ — กำหนดจำนวนรอบขั้นต่ำและเวรที่ต้องตรวจสำหรับแต่ละหมวดงาน">
      <InspectionPolicyAdmin initialPolicies={policies} />
    </AppShell>
  );
}
