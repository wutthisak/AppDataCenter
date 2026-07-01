import type { AssetOptionType } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { BasicSettingsAdmin } from "@/components/BasicSettingsAdmin";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const optionTypes: AssetOptionType[] = [
  "DATABASE_TYPE",
  "OS_TYPE",
  "NETWORK_BRAND",
  "DEVICE_TYPE",
  "STORAGE_DEVICE_TYPE",
  "BUILDING",
  "ASSET_OWNERSHIP_TYPE"
];

const validTabs = ["database", "os", "network", "device-type", "storage-device-type", "building", "ownership"];

export default async function BasicSettingsPage(
  props: { searchParams: Promise<{ error?: string; tab?: string; saved?: string }> }
) {
  const searchParams = await props.searchParams;
  await requireUser(["ADMIN"]);

  const activeTab = validTabs.includes(searchParams.tab ?? "") ? searchParams.tab! : "database";

  const options = await prisma.assetOption.findMany({
    where: { type: { in: optionTypes } },
    orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { value: "asc" }]
  });

  return (
    <AppShell title="ตั้งค่าข้อมูลพื้นฐาน" subtitle="จัดการตัวเลือก dropdown และค่ามาตรฐานที่ใช้ร่วมกันในระบบ" hideTopbar>
      <BasicSettingsAdmin
        options={options}
        activeTab={activeTab}
        error={searchParams.error}
        saved={searchParams.saved}
      />
    </AppShell>
  );
}
