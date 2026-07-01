import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { ClearInspectionDataPanel } from "@/components/ClearInspectionDataPanel";

export default async function MaintenancePage() {
  await requireUser(["ADMIN"]);

  return (
    <AppShell
      title="System Maintenance"
      subtitle="เครื่องมือบำรุงรักษาระบบสำหรับผู้ดูแลระบบ"
    >
      <ClearInspectionDataPanel />
    </AppShell>
  );
}
