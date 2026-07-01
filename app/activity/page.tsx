import React from "react";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import {
  formatDuration,
  getInspectionKpi,
  getInspectionKpiByCategory,
  getInspectionRounds,
  getWorkloadDashboard,
  type WorkloadDashboard,
  SHIFT_LABELS,
  CATEGORY_LABELS,
} from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { ListChecks, Clock, CheckCircle, AlertTriangle, TrendingUp, Calendar, Users } from "lucide-react";

const VALID_DAYS = [1, 7, 14, 30] as const;
type ValidDays = typeof VALID_DAYS[number];

const THAI_MONTHS = [
  "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const TIME_SLOT_LABELS: Record<string, string> = {
  SLOT_0800_0900: "08:00–09:00", SLOT_0900_1000: "09:00–10:00", SLOT_1000_1100: "10:00–11:00",
  SLOT_1100_1200: "11:00–12:00", SLOT_1200_1300: "12:00–13:00", SLOT_1300_1400: "13:00–14:00",
  SLOT_1400_1500: "14:00–15:00", SLOT_1500_1600: "15:00–16:00", SLOT_1600_1700: "16:00–17:00",
  SLOT_1700_1800: "17:00–18:00", SLOT_1800_1900: "18:00–19:00", SLOT_1900_2000: "19:00–20:00",
  SLOT_2000_2100: "20:00–21:00", SLOT_2100_2200: "21:00–22:00", SLOT_2200_2300: "22:00–23:00",
  SLOT_2300_0000: "23:00–00:00", SLOT_0000_0100: "00:00–01:00", SLOT_0100_0200: "01:00–02:00",
  SLOT_0200_0300: "02:00–03:00", SLOT_0300_0400: "03:00–04:00", SLOT_0400_0500: "04:00–05:00",
  SLOT_0500_0600: "05:00–06:00", SLOT_0600_0700: "06:00–07:00", SLOT_0700_0800: "07:00–08:00",
};

function parseDays(value: string | undefined): ValidDays {
  const n = Number(value);
  return (VALID_DAYS as readonly number[]).includes(n) ? n as ValidDays : 7;
}

function formatTime(dt: Date | null | undefined): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function slotStartTime(slot: string): string {
  const m = slot.match(/SLOT_(\d{2})(\d{2})_(\d{2})(\d{2})/);
  if (!m) return "—";
  return `${m[1]}:${m[2]}`;
}

function slotEndTime(slot: string): string {
  const m = slot.match(/SLOT_(\d{2})(\d{2})_(\d{2})(\d{2})/);
  if (!m) return "—";
  return `${m[3]}:${m[4]}`;
}

function formatDateTH(dt: Date | null | undefined, month: number, buddhistYear: number, day: number): string {
  if (dt) return new Date(dt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  return `${day} ${THAI_MONTHS[month]} ${buddhistYear}`;
}

export default async function ActivityDashboardPage(
  props: {
    searchParams: Promise<{ days?: string; month?: string; year?: string; cat?: string; shift?: string; status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await requireUser();

  const now = new Date();
  const currentBuddhistYear = now.getFullYear() + 543;
  const currentMonth = now.getMonth() + 1;

  const selectedMonth = parseInt(searchParams.month ?? "") || currentMonth;
  const selectedYear = parseInt(searchParams.year ?? "") || currentBuddhistYear;
  const isMonthlyMode = !!(searchParams.month || searchParams.year);
  const catFilter = searchParams.cat ?? "ALL";
  const shiftFilter = searchParams.shift ?? "ALL";
  const statusFilter = (searchParams.status ?? "all") as "all" | "normal" | "abnormal";

  let since: Date;
  let until: Date | undefined;
  let days: ValidDays = 7;
  let rangeLabel: string;

  if (isMonthlyMode) {
    const gregorianYear = selectedYear - 543;
    since = new Date(gregorianYear, selectedMonth - 1, 1, 0, 0, 0, 0);
    until = new Date(gregorianYear, selectedMonth, 0, 23, 59, 59, 999);
    rangeLabel = `${THAI_MONTHS[selectedMonth]} ${selectedYear}`;
  } else {
    days = parseDays(searchParams.days);
    since = new Date();
    since.setDate(since.getDate() - (days === 1 ? 0 : days));
    since.setHours(0, 0, 0, 0);
    rangeLabel = days === 1 ? "วันนี้" : `${days} วันล่าสุด`;
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentBuddhistYear - i);

  const [kpi, kpiByCat, rounds, workload] = await Promise.all([
    getInspectionKpi(since, until),
    getInspectionKpiByCategory(since, until),
    getInspectionRounds(since, until, {
      categoryCode: catFilter !== "ALL" ? catFilter : undefined,
      shift: shiftFilter,
      statusFilter,
      limit: 100,
    }),
    getWorkloadDashboard(since, until, {
      categoryCode: catFilter !== "ALL" ? catFilter : undefined,
      shift: shiftFilter !== "ALL" ? shiftFilter : undefined,
      statusFilter,
    }),
  ]);

  const FILTER_DAYS: { label: string; value: number }[] = [
    { label: "วันนี้", value: 1 },
    { label: "7 วัน", value: 7 },
    { label: "14 วัน", value: 14 },
    { label: "30 วัน", value: 30 },
  ];

  // Dynamic categories from AssetCategory
  const dbCategories = await prisma.assetCategory.findMany({
    orderBy: { displayOrder: "asc" },
    select: { code: true, name: true }
  });
  const CAT_OPTIONS = [
    { label: "ทุกหมวด", value: "ALL" },
    ...dbCategories.map((c) => ({ label: c.name, value: c.code })),
  ].filter((opt, idx, arr) => arr.findIndex((o) => o.value === opt.value) === idx);

  const SHIFT_OPTIONS = [
    { label: "ทุกเวร", value: "ALL" },
    { label: "เวรเช้า", value: "MORNING_SHIFT" },
    { label: "เวรบ่าย", value: "AFTERNOON_SHIFT" },
    { label: "เวรดึก", value: "NIGHT_SHIFT" },
    { label: "เวลาทำการ", value: "OFFICE_HOURS" },
  ];

  return (
    <AppShell>
      <div className="activity-page">

        {/* ── Hero ── */}
        <div className="activity-hero">
          <div className="activity-hero-bg">
            <div className="activity-hero-circle activity-hero-circle--1" />
            <div className="activity-hero-circle activity-hero-circle--2" />
          </div>
          <div className="activity-hero-content">
            <div className="activity-hero-text">
              <div className="activity-hero-eyebrow"><TrendingUp size={14} /> Operations Monitor</div>
              <h2>ติดตามการตรวจ</h2>
              <p>ติดตามการบันทึกผลตรวจของผู้ดูแลระบบ แยกตามหมวดงาน เวร ช่วงเวลา และสถานะการตรวจ</p>
            </div>
            <div className="activity-hero-meta">
              <div className="activity-hero-date"><Calendar size={14} /><span>{rangeLabel}</span></div>
            </div>
          </div>
        </div>

        {/* ── KPI + Filter Panel ── */}
        {(() => {
          const baseParams = isMonthlyMode ? `month=${selectedMonth}&year=${selectedYear}` : `days=${days}`;
          const normalHref = `/activity?${baseParams}&cat=${catFilter}&shift=${shiftFilter}&status=normal`;
          const abnormalHref = `/activity?${baseParams}&cat=${catFilter}&shift=${shiftFilter}&status=abnormal`;
          const isNormalActive = statusFilter === "normal";
          const isAbnormalActive = statusFilter === "abnormal";

          const workloadByUser = workload.users;

          const kpiItem = (icon: React.ReactNode, label: string, value: React.ReactNode, sub: string, accent: string, href?: string, active?: boolean) => {
            const inner = (
              <div style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                background: "#fff", borderRadius: 14, border: `1px solid ${active ? accent : "#e2e8f0"}`,
                boxShadow: active ? `0 0 0 2px ${accent}22` : "0 1px 4px rgba(0,0,0,.05)",
                cursor: href ? "pointer" : "default", transition: "all .15s", height: "100%"
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, flexShrink: 0 }}>{icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
                </div>
              </div>
            );
            return href ? <a key={label} href={href} style={{ textDecoration: "none", display: "block" }}>{inner}</a> : <div key={label}>{inner}</div>;
          };

          const pill = (label: string, href: string, active: boolean, color = "#2563eb") => (
            <a key={label} href={href} style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500,
              background: active ? color : "transparent", color: active ? "#fff" : "#64748b",
              border: active ? `1px solid ${color}` : "1px solid transparent",
              textDecoration: "none", transition: "all .12s", whiteSpace: "nowrap"
            }}>{label}</a>
          );

          return (
            <>
              {/* KPI Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 12 }}>
                {kpiItem(<ListChecks size={18} />, "ตรวจแล้ว", kpi.roundCount, "รายการ", "#2563eb")}
                {kpiItem(<CheckCircle size={18} />, "ปกติ", kpi.normalCount, isNormalActive ? "▼ กำลังแสดง" : "คลิกดูรายการ", "#10b981", normalHref, isNormalActive)}
                {kpiItem(<AlertTriangle size={18} />, "พบปัญหา", kpi.abnormalCount, isAbnormalActive ? "▼ กำลังแสดง" : "คลิกดูรายการ", kpi.abnormalCount > 0 ? "#ef4444" : "#94a3b8", abnormalHref, isAbnormalActive)}
                {kpiItem(<Clock size={18} />, "เวลาตรวจรวม", kpi.totalMinutes > 0 ? formatDuration(kpi.totalMinutes) : "—", "ระยะเวลาจริง", "#7c3aed")}
                {kpiItem(<Users size={18} />, "ผู้บันทึก", workloadByUser.length, "ผู้ดูแลระบบ", "#0284c7")}
              </div>

              {/* Filter Panel */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "12px 16px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                <div style={{ display: "flex", gap: 0, flexDirection: "column" }}>
                  {/* Period row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, borderBottom: "1px solid #f1f5f9", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", width: 56, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>ช่วงเวลา</span>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                      {FILTER_DAYS.map((opt) => pill(opt.label, `/activity?days=${opt.value}&cat=${catFilter}&shift=${shiftFilter}&status=${statusFilter}`, !isMonthlyMode && days === opt.value))}
                      <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
                      <form method="get" style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {catFilter !== "ALL" && <input type="hidden" name="cat" value={catFilter} />}
                        {shiftFilter !== "ALL" && <input type="hidden" name="shift" value={shiftFilter} />}
                        {statusFilter !== "all" && <input type="hidden" name="status" value={statusFilter} />}
                        <select name="month" defaultValue={selectedMonth} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid #e2e8f0", background: isMonthlyMode ? "#eff6ff" : "#f8fafc", color: isMonthlyMode ? "#2563eb" : "#475569" }}>
                          {THAI_MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                        <select name="year" defaultValue={selectedYear} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid #e2e8f0", background: isMonthlyMode ? "#eff6ff" : "#f8fafc", color: isMonthlyMode ? "#2563eb" : "#475569" }}>
                          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button type="submit" style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}><Calendar size={12} />ดูเดือน</button>
                      </form>
                    </div>
                  </div>
                  {/* Cat + Shift + Status in one row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>หมวด</span>
                      {CAT_OPTIONS.map((opt) => pill(opt.label, `/activity?${baseParams}&cat=${opt.value}&shift=${shiftFilter}&status=${statusFilter}`, catFilter === opt.value))}
                    </div>
                    <div style={{ width: 1, height: 20, background: "#e2e8f0", flexShrink: 0 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>เวร</span>
                      {SHIFT_OPTIONS.map((opt) => pill(opt.label, `/activity?${baseParams}&cat=${catFilter}&shift=${opt.value}&status=${statusFilter}`, shiftFilter === opt.value, "#7c3aed"))}
                    </div>
                    <div style={{ width: 1, height: 20, background: "#e2e8f0", flexShrink: 0 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>สถานะ</span>
                      {[{ label: "ทั้งหมด", value: "all", color: "#374151" }, { label: "ปกติ", value: "normal", color: "#10b981" }, { label: "ผิดปกติ", value: "abnormal", color: "#ef4444" }].map((opt) =>
                        pill(opt.label, `/activity?${baseParams}&cat=${catFilter}&shift=${shiftFilter}&status=${opt.value}`, statusFilter === opt.value, opt.color)
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}


        {/* ── Workload Dashboard ── */}
        {(() => {
          const w: WorkloadDashboard = workload;
          const maxPct = Math.max(...w.users.map((u) => u.workloadPct), 1);
          return (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                  <Users size={16} style={{ color: "#7c3aed" }} /> Workload ผู้ดูแลระบบ
                </div>
                <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>ผู้ใช้งาน Active {w.activeUserCount} คน</span>
              </div>

              {/* KPI Cards — 4 columns × 2 rows */}
              {(() => {
                const activeWithWork = w.users.filter((u) => u.itemCount > 0).length;
                const wlColor = w.teamWorkloadPct >= 80 ? "#ef4444" : w.teamWorkloadPct >= 50 ? "#f59e0b" : "#10b981";
                const wlBg   = w.teamWorkloadPct >= 80 ? "#fef2f2" : w.teamWorkloadPct >= 50 ? "#fffbeb" : "#f0fdf4";
                const kpis = [
                  { label: "ผู้ดูแล Active",          value: String(w.activeUserCount),                   unit: "คน",   color: "#2563eb", bg: "#eff6ff", desc: `มีการตรวจ ${activeWithWork} คน` },
                  { label: "รอบตรวจ",                  value: String(w.teamRoundCount),                    unit: "รอบ",  color: "#0891b2", bg: "#e0f2fe", desc: "รอบไม่ซ้ำ (deduplicated)" },
                  { label: "จำนวนรายการ",               value: String(w.teamItemCount),                     unit: "ราย",  color: "#475569", bg: "#f8fafc", desc: "รายการตรวจสอบทั้งหมด" },
                  { label: "เวลาตรวจจริงรวม",          value: formatDuration(w.teamTotalMin),              unit: "",     color: "#0284c7", bg: "#e0f2fe", desc: "รวม durationMinutes รอบตรวจ" },
                  { label: "เฉลี่ยต่อรอบ",              value: w.teamAvgRoundMin > 0 ? String(w.teamAvgRoundMin) : "—", unit: w.teamAvgRoundMin > 0 ? "นาที" : "", color: "#7c3aed", bg: "#f5f3ff", desc: "เวลาตรวจจริง / รอบตรวจ" },
                  { label: "เฉลี่ยต่อรายการ",           value: w.teamAvgItemMin > 0  ? String(w.teamAvgItemMin)  : "—", unit: w.teamAvgItemMin  > 0 ? "นาที" : "", color: "#7c3aed", bg: "#f5f3ff", desc: "เวลาตรวจจริง / จำนวนรายการ" },
                  { label: "Personal Workload เฉลี่ย", value: `${w.teamWorkloadPct}%`,                    unit: "",     color: wlColor, bg: wlBg, desc: "เฉลี่ยของทุกคนที่มี Capacity" },
                  { label: "Team Capacity",             value: formatDuration(w.teamCapacityMin),           unit: "",     color: "#64748b", bg: "#f8fafc", desc: "รวมตามช่วงเวลาที่แต่ละคนตรวจ" },
                ];
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                    {kpis.map((item) => (
                      <div key={item.label} style={{ background: item.bg, borderRadius: 12, padding: "12px 14px", border: `1px solid ${item.color}22` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{item.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: item.color, lineHeight: 1.2 }}>
                          {item.value}<span style={{ fontSize: 11, fontWeight: 500 }}>{item.unit ? ` ${item.unit}` : ""}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, lineHeight: 1.4 }}>{item.desc}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Formula note */}
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12, padding: "8px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #f1f5f9", lineHeight: 1.8 }}>
                <strong style={{ color: "#2563eb" }}>Personal Workload</strong>{" = เวลาตรวจจริง / Capacity × 100  ·  "}
                <strong style={{ color: "#7c3aed" }}>Team Distribution</strong>{" = เวลาตรวจของคนนั้น / เวลาตรวจรวม × 100  ·  "}
                Capacity/คน = จำนวน slot ที่ตรวจ × 60 นาที{"  "}·{"  "}
                <span style={{ color: "#f59e0b", fontWeight: 600 }}>หมายเหตุ:</span>{" "}รายการที่ไม่เลือกระยะเวลาตรวจ จะไม่นับในเวลาตรวจจริง
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 18, marginBottom: 10, fontSize: 11, color: "#64748b" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 16, height: 6, borderRadius: 99, background: "#2563eb", display: "inline-block" }} />
                  Personal Workload (%)
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 16, height: 6, borderRadius: 99, background: "#7c3aed", display: "inline-block" }} />
                  Team Distribution (%)
                </span>
              </div>

              {/* User table / Empty state */}
              {w.users.filter((u) => u.itemCount > 0).length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
                  <Users size={32} style={{ margin: "0 auto 8px", opacity: 0.35 }} />
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#64748b" }}>ไม่มีข้อมูลการตรวจในช่วงเวลานี้</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>ลองเปลี่ยน Filter หรือช่วงวันที่</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                        {["ผู้ดูแลระบบ", "เวร / ช่วงเวลา", "รอบตรวจ", "จำนวนรายการ", "Capacity", "เวลาตรวจจริง", "เฉลี่ย/รอบ", "เฉลี่ย/รายการ", "Personal Workload", "Team Distribution"].map((h) => (
                          <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#475569", whiteSpace: "nowrap", fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {w.users.filter((u) => u.itemCount > 0).map((u, idx) => {
                        const wlColor = u.workloadPct >= 80 ? "#ef4444" : u.workloadPct >= 50 ? "#f59e0b" : "#2563eb";
                        const shiftLabel = u.shifts.length > 0
                          ? u.shifts.map((s) => SHIFT_LABELS[s] ?? s).join(", ")
                          : "—";
                        return (
                          <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#fff" : "#fafbfc" }}>
                            <td style={{ padding: "9px 12px", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                                  {u.name.trim().slice(0, 2).toUpperCase()}
                                </div>
                                {u.name}
                              </div>
                            </td>
                            <td style={{ padding: "9px 12px", color: "#64748b", fontSize: 11 }}>
                              <div style={{ whiteSpace: "nowrap" }}>{shiftLabel}</div>
                              {u.slotCount > 0 && <div style={{ color: "#94a3b8", marginTop: 2 }}>{u.slotCount} ช่วงเวลา</div>}
                            </td>
                            <td style={{ padding: "9px 12px", color: "#2563eb", fontWeight: 700, textAlign: "right" }}>{u.roundCount}</td>
                            <td style={{ padding: "9px 12px", color: "#475569", textAlign: "right" }}>{u.itemCount}</td>
                            <td style={{ padding: "9px 12px", color: "#7c3aed", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {u.capacityMin > 0 ? formatDuration(u.capacityMin) : "—"}
                            </td>
                            <td style={{ padding: "9px 12px", color: "#0284c7", fontWeight: 700, whiteSpace: "nowrap" }}>
                              {u.totalMin > 0 ? formatDuration(u.totalMin) : "—"}
                            </td>
                            <td style={{ padding: "9px 12px", color: "#475569", whiteSpace: "nowrap" }}>
                              {u.avgPerRound > 0 ? `${u.avgPerRound} นาที` : "—"}
                            </td>
                            <td style={{ padding: "9px 12px", color: "#475569", whiteSpace: "nowrap" }}>
                              {u.avgPerItem > 0 ? `${u.avgPerItem} นาที` : "—"}
                            </td>
                            {/* Personal Workload bar — blue */}
                            <td style={{ padding: "9px 12px", minWidth: 150 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ flex: 1, height: 6, background: "#dbeafe", borderRadius: 99, overflow: "hidden" }}>
                                  <div style={{ width: `${Math.min(u.workloadPct, 100)}%`, height: "100%", background: wlColor, borderRadius: 99, transition: "width .4s" }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: wlColor, minWidth: 38, textAlign: "right" }}>
                                  {u.capacityMin > 0 ? `${u.workloadPct}%` : "—"}
                                </span>
                              </div>
                            </td>
                            {/* Team Distribution bar — purple */}
                            <td style={{ padding: "9px 12px", minWidth: 150 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ flex: 1, height: 6, background: "#ede9fe", borderRadius: 99, overflow: "hidden" }}>
                                  <div style={{ width: `${Math.min(u.distributionPct, 100)}%`, height: "100%", background: "#7c3aed", borderRadius: 99, transition: "width .4s" }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", minWidth: 38, textAlign: "right" }}>
                                  {u.distributionPct > 0 ? `${u.distributionPct}%` : "0%"}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Category Breakdown ── */}
        {kpiByCat.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "18px 20px", marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 14 }}>เวลาตรวจรวมแต่ละหมวด</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {kpiByCat.map((cat) => (
                <div key={cat.code} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ width: 180, fontSize: 13, fontWeight: 600, color: "#374151", flexShrink: 0 }}>{cat.name}</span>
                  <div style={{ flex: 1, minWidth: 100, height: 8, background: "#f1f5f9", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ width: `${cat.pct}%`, height: "100%", background: "linear-gradient(90deg,#3b82f6,#8b5cf6)", borderRadius: 8, transition: "width .5s" }} />
                  </div>
                  <span style={{ fontSize: 12, color: "#64748b", width: 90, textAlign: "right", flexShrink: 0 }}>
                    {cat.totalMinutes > 0 ? formatDuration(cat.totalMinutes) : "—"} · {cat.roundCount} รอบ
                  </span>
                  <span style={{ fontSize: 12, color: cat.abnormalCount > 0 ? "#ef4444" : "#10b981", fontWeight: 600, width: 60, textAlign: "right", flexShrink: 0 }}>
                    {cat.abnormalCount > 0 ? `⚠ ${cat.abnormalCount} ผิดปกติ` : "✓ ปกติ"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Inspection Rounds Table ── */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}><ListChecks size={16} style={{ color: "#2563eb" }} /> รายการล่าสุด</div>
            <span style={{ fontSize: 13, color: "#64748b" }}>{rounds.length} รายการ</span>
          </div>
          {rounds.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8" }}>
              <ListChecks size={36} style={{ margin: "0 auto 12px", opacity: .4 }} />
              <div style={{ fontSize: 15, fontWeight: 600 }}>ไม่พบข้อมูลรอบการตรวจ</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>ลองปรับช่วงเวลาหรือ filter แล้วลองใหม่</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {["เวลา", "ผู้ดูแลระบบ", "หมวด", "รายการ", "เวร / ช่วงเวลา", "เวลาเริ่ม", "เวลาสิ้นสุด", "ระยะเวลา", "สถานะ", "หมายเหตุ"].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((r: any, idx: number) => {
                    const isNormal = r.statusCode === "N";
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#fff" : "#fafbfc" }}>
                        <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "#374151", fontSize: 12 }}>
                          {r.updatedAt ? new Date(r.updatedAt).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td style={{ padding: "9px 12px", color: "#64748b", whiteSpace: "nowrap" }}>{r.updatedBy?.displayName ?? "—"}</td>
                        <td style={{ padding: "9px 12px" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, background: "#eff6ff", color: "#2563eb", borderRadius: 6, padding: "2px 8px" }}>
                            {CATEGORY_LABELS[r.asset.category.code] ?? r.asset.category.name}
                          </span>
                        </td>
                        <td style={{ padding: "9px 12px", color: "#1e293b", fontWeight: 500 }}>{r.asset.name}</td>
                        <td style={{ padding: "9px 12px", color: "#64748b", whiteSpace: "nowrap", fontSize: 12 }}>
                          <div>{SHIFT_LABELS[r.inspectionShift] ?? r.inspectionShift}</div>
                          <div style={{ color: "#94a3b8" }}>{TIME_SLOT_LABELS[r.timeSlot] ?? r.timeSlot}</div>
                        </td>
                        <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "#475569" }}>
                          {r.inspectionStartedAt ? formatTime(r.inspectionStartedAt) : <span style={{ color: "#64748b" }}>{slotStartTime(r.timeSlot)}</span>}
                        </td>
                        <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "#475569" }}>
                          {r.inspectionCompletedAt ? formatTime(r.inspectionCompletedAt) : <span style={{ color: "#64748b" }}>{slotEndTime(r.timeSlot)}</span>}
                        </td>
                        <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                          {r.durationMinutes
                            ? <span style={{ fontWeight: 700, color: "#7c3aed" }}>{r.durationMinutes} นาที</span>
                            : <span style={{ color: "#cbd5e1" }}>—</span>}
                        </td>
                        <td style={{ padding: "9px 12px" }}>
                          <span style={{
                            fontSize: 12, fontWeight: 700, borderRadius: 6, padding: "3px 10px",
                            background: isNormal ? "#f0fdf4" : "#fef2f2",
                            color: isNormal ? "#10b981" : "#ef4444",
                            border: `1px solid ${isNormal ? "#bbf7d0" : "#fecaca"}`
                          }}>
                            {isNormal ? "ปกติ" : r.statusCode}
                          </span>
                        </td>
                        <td style={{ padding: "9px 12px", color: "#94a3b8", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.note ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
