import type { AssetOption, AssetOptionType } from "@prisma/client";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { SaveToastManager } from "@/components/SaveToastManager";
import { addAssetOptionAction, deleteAssetOptionAction, updateAssetOptionAction, updateSystemSettingAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type OptionGroup = {
  type: AssetOptionType;
  tabId: string;
  title: string;
  icon: string;
  description: string;
  placeholder: string;
  accentColor: string;
  accentBg: string;
};

const optionGroups: OptionGroup[] = [
  {
    type: "DATABASE_TYPE",
    tabId: "database",
    title: "Type Database",
    icon: "🗄️",
    description: "ประเภทฐานข้อมูลสำหรับบัญชีทรัพย์สิน Database",
    placeholder: "เพิ่มเช่น MySQL, SQL Server",
    accentColor: "#2563eb",
    accentBg: "#eff6ff"
  },
  {
    type: "OS_TYPE",
    tabId: "os",
    title: "Type OS",
    icon: "💻",
    description: "ระบบปฏิบัติการสำหรับ VM Host และ Host Server",
    placeholder: "เพิ่มเช่น Windows, Ubuntu, Rocky",
    accentColor: "#059669",
    accentBg: "#ecfdf5"
  },
  {
    type: "NETWORK_BRAND",
    tabId: "network",
    title: "ยี่ห้ออุปกรณ์",
    icon: "🔌",
    description: "ยี่ห้ออุปกรณ์เครือข่าย Switch / Firewall",
    placeholder: "เพิ่มเช่น Cisco, Huawei, HPE",
    accentColor: "#7c3aed",
    accentBg: "#f5f3ff"
  },
  {
    type: "BUILDING",
    tabId: "building",
    title: "อาคาร",
    icon: "🏢",
    description: "ชื่ออาคารสำหรับระบุตำแหน่งติดตั้งอุปกรณ์",
    placeholder: "เพิ่มเช่น อาคาร A, อาคาร B",
    accentColor: "#d97706",
    accentBg: "#fffbeb"
  }
];

const errorMessages: Record<string, string> = {
  invalid: "กรุณากรอกข้อมูลให้ครบถ้วน",
  duplicate: "มีค่านี้อยู่แล้วในประเภทเดียวกัน",
  "not-found": "ไม่พบรายการที่ต้องการแก้ไข"
};

function renderTabContent(group: OptionGroup, options: AssetOption[], activeTab: string) {
  const returnTo = `/admin/settings/basic?tab=${group.tabId}`;
  const isActive = activeTab === group.tabId;

  return (
    <div
      key={group.type}
      className="stab-panel"
      style={{ display: isActive ? "grid" : "none" }}
      role="tabpanel"
    >
      <div className="stab-panel-header">
        <div className="stab-panel-meta">
          <span className="stab-panel-icon" style={{ background: group.accentBg, color: group.accentColor }}>
            {group.icon}
          </span>
          <div>
            <div className="stab-panel-title">{group.title}</div>
            <div className="stab-panel-desc">{group.description}</div>
          </div>
        </div>
        <div className="stab-count" style={{ background: group.accentBg, color: group.accentColor }}>
          <b>{options.length}</b>
          <span>รายการ</span>
        </div>
      </div>

      <form className="stab-add-form" action={addAssetOptionAction}>
        <input type="hidden" name="type" value={group.type} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input name="value" placeholder={group.placeholder} required className="stab-add-input" />
        <button className="button stab-add-btn" type="submit" style={{ background: group.accentColor }}>
          + เพิ่ม
        </button>
      </form>

      <div className="stab-option-list">
        {options.length === 0 ? (
          <div className="stab-empty">ยังไม่มีรายการ — กรอกด้านบนเพื่อเพิ่ม</div>
        ) : options.map((option, index) => (
          <div className="stab-option-row" key={option.id}>
            <span className="stab-option-num" style={{ color: group.accentColor }}>{String(index + 1).padStart(2, "0")}</span>
            <form className="stab-edit-form" action={updateAssetOptionAction}>
              <input type="hidden" name="optionId" value={option.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input name="value" defaultValue={option.value} required />
              <button className="button secondary" type="submit">บันทึก</button>
            </form>
            <form action={deleteAssetOptionAction}>
              <input type="hidden" name="optionId" value={option.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button className="button danger" type="submit">ลบ</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

const WORKLOAD_TAB_ID = "workload";

const workloadSettings = [
  { key: "workload_min_vm",      label: "ตรวจสอบ VM Host",      icon: "🖥️", description: "นาที/เครื่อง สำหรับ DailyStatusEntry หมวด VM Host" },
  { key: "workload_min_server",  label: "ตรวจสอบ Host Server",  icon: "📲", description: "นาที/เครื่อง สำหรับ DailyStatusEntry หมวด Host Server" },
  { key: "workload_min_network", label: "ตรวจสอบ Network Device", icon: "🔌", description: "นาที/เครื่อง สำหรับ DailyStatusEntry หมวด Network Device" }
];

export default async function BasicSettingsPage(
  props: { searchParams: Promise<{ error?: string; tab?: string; saved?: string }> }
) {
  const searchParams = await props.searchParams;
  await requireUser(["ADMIN"]);

  const validTabIds = [...optionGroups.map((g) => g.tabId), WORKLOAD_TAB_ID];
  const activeTab = validTabIds.includes(searchParams.tab ?? "") ? searchParams.tab! : optionGroups[0].tabId;

  const [options, systemSettings] = await Promise.all([
    prisma.assetOption.findMany({
      where: { type: { in: optionGroups.map((group) => group.type) } },
      orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { value: "asc" }]
    }),
    prisma.systemSetting.findMany({
      where: { key: { in: workloadSettings.map((s) => s.key) } }
    })
  ]);

  const settingValues: Record<string, string> = {};
  for (const s of systemSettings) settingValues[s.key] = s.value;

  const optionsByType = options.reduce<Record<AssetOptionType, AssetOption[]>>((acc, option) => {
    acc[option.type].push(option);
    return acc;
  }, {
    DATABASE_TYPE: [],
    OS_TYPE: [],
    NETWORK_BRAND: [],
    BUILDING: []
  });

  return (
    <AppShell title="ตั้งค่าพื้นฐาน" subtitle="จัดการตัวเลือก dropdown ที่ใช้ในบัญชีทรัพย์สิน">
      <Suspense fallback={null}>
        <SaveToastManager />
      </Suspense>
      <div className="stab-page">

        <div className="stab-container">
          <nav className="stab-nav" role="tablist">
            {optionGroups.map((group) => {
              const count = optionsByType[group.type].length;
              const isActive = activeTab === group.tabId;
              return (
                <a
                  key={group.tabId}
                  href={`/admin/settings/basic?tab=${group.tabId}`}
                  className={"stab-tab" + (isActive ? " stab-tab--active" : "")}
                  style={isActive ? { borderColor: group.accentColor, color: group.accentColor } : undefined}
                  role="tab"
                  aria-selected={isActive}
                >
                  <span className="stab-tab-icon">{group.icon}</span>
                  <span className="stab-tab-label">{group.title}</span>
                  <span
                    className="stab-tab-badge"
                    style={isActive ? { background: group.accentBg, color: group.accentColor } : undefined}
                  >
                    {count}
                  </span>
                </a>
              );
            })}
            <a
              href={`/admin/settings/basic?tab=${WORKLOAD_TAB_ID}`}
              className={"stab-tab" + (activeTab === WORKLOAD_TAB_ID ? " stab-tab--active" : "")}
              style={activeTab === WORKLOAD_TAB_ID ? { borderColor: "#0891b2", color: "#0891b2" } : undefined}
              role="tab"
              aria-selected={activeTab === WORKLOAD_TAB_ID}
            >
              <span className="stab-tab-icon">⏱️</span>
              <span className="stab-tab-label">Workload</span>
              <span
                className="stab-tab-badge"
                style={activeTab === WORKLOAD_TAB_ID ? { background: "#ecfeff", color: "#0891b2" } : undefined}
              >
                {workloadSettings.length}
              </span>
            </a>
          </nav>

          <div className="stab-body">
            {optionGroups.map((group) =>
              renderTabContent(group, optionsByType[group.type], activeTab)
            )}
            <div
              className="stab-panel"
              style={{ display: activeTab === WORKLOAD_TAB_ID ? "grid" : "none" }}
              role="tabpanel"
            >
              <div className="stab-panel-header">
                <div className="stab-panel-meta">
                  <span className="stab-panel-icon" style={{ background: "#ecfeff", color: "#0891b2" }}>⏱️</span>
                  <div>
                    <div className="stab-panel-title">Workload Standard Minutes</div>
                    <div className="stab-panel-desc">กำหนดนาทีมาตรฐานต่ออุปกรณ์สำหรับคำนวณ workload ใน Activity Dashboard</div>
                  </div>
                </div>
              </div>
              {searchParams.saved === "1" && activeTab === WORKLOAD_TAB_ID && (
                <div style={{ padding: "10px 14px", background: "#ecfdf5", border: "1px solid #86efac", borderRadius: 8, color: "#166534", fontWeight: 700, fontSize: 14 }}>
                  ✓ บันทึกค่าสำเร็จ
                </div>
              )}
              <form action={updateSystemSettingAction} className="stab-workload-form">
                <input type="hidden" name="returnTo" value={`/admin/settings/basic?tab=${WORKLOAD_TAB_ID}`} />
                {workloadSettings.map((s) => (
                  <div className="stab-workload-row" key={s.key}>
                    <div className="stab-workload-meta">
                      <span className="stab-workload-icon">{s.icon}</span>
                      <div>
                        <div className="stab-workload-label">{s.label}</div>
                        <div className="stab-workload-desc">{s.description}</div>
                      </div>
                    </div>
                    <div className="stab-workload-input-wrap">
                      <input
                        type="number"
                        name={s.key}
                        defaultValue={settingValues[s.key] ?? "5"}
                        min="0"
                        max="999"
                        step="1"
                        required
                        className="stab-workload-input"
                      />
                      <span className="stab-workload-unit">นาที/เครื่อง</span>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
                  <button className="button" type="submit" style={{ background: "#0891b2", color: "#fff", border: "none", fontWeight: 800 }}>
                    ✓ บันทึกทั้งหมด
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
