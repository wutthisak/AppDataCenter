import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Filter,
  RefreshCcw,
  Server,
  ShieldCheck,
  Zap
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OperationsTrendChart, ResourceAverageChart } from "@/components/DashboardCharts";
import { requireUser } from "@/lib/auth";
import {
  dashboardQueryString,
  getDashboardData,
  parseDashboardFilters,
  type DashboardSearchParams
} from "@/lib/dashboard";
import {
  inspectionShiftLabels,
  inspectionShiftOrder
} from "@/lib/inspection-shifts";

// ── Helpers ───────────────────────────────────────────────────────────────────
const C = {
  blue:   "#2563eb", teal:   "#0891b2", green:  "#059669",
  red:    "#dc2626", orange: "#d97706", purple: "#7c3aed",
  indigo: "#4f46e5", slate:  "#475569"
} as const;

function pctColor(v: number) {
  return v >= 90 ? C.green : v >= 70 ? C.blue : v > 0 ? C.orange : C.slate;
}
function statusTone(s: string) {
  if (s.includes("วิกฤต") || s.includes("ผิดปกติ") || s.includes("ระบบล่ม") || s.includes("ไม่สำเร็จ")) return "danger";
  if (s.includes("เฝ้าระวัง") || s.includes("หยุด") || s.includes("ปิดระบบ") || s.includes("รีสตาร์ท")) return "warning";
  return "normal";
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionBadge({ emoji, label, color, bg }: { emoji: string; label: string; color: string; bg: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: bg, color, padding: "3px 12px", borderRadius: 99, fontSize: 12, fontWeight: 800 }}>
      {emoji} {label}
    </span>
  );
}

function KCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub: string; icon: React.ReactNode; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", border: `1px solid ${color}22`, borderTop: `3px solid ${color}`, boxShadow: "0 1px 4px rgba(0,0,0,.06)", display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}14`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

function PBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 7, background: "#f1f5f9", borderRadius: 99, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 99, transition: "width .4s" }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function DashboardPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
  const searchParams = await props.searchParams;
  await requireUser();

  const filters = parseDashboardFilters(searchParams);
  const data    = await getDashboardData(filters);
  const dailyHref   = `/?${dashboardQueryString(filters, { mode: "daily" })}`;
  const monthlyHref = `/?${dashboardQueryString(filters, { mode: "monthly" })}`;
  const exportHref  = `/api/dashboard/export?${dashboardQueryString(filters)}`;
  const periodLabel = filters.mode === "daily" ? data.period.selectedDateLabel : data.period.monthLabel;
  const s = data.summary;
  const kpi = data.infrastructureKpi;
  const compliancePct = s.completedCount > 0 ? Math.round(((s.completedCount - s.totalIssues) / s.completedCount) * 100) : 0;

  return (
    <AppShell>
      <div style={{ padding: "0 0 40px" }}>

        {/* ── Hero ── */}
        <div style={{ background: "linear-gradient(135deg,#1e3a8a 0%,#4f46e5 55%,#7c3aed 100%)", padding: "20px 28px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📊</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#a5b4fc", letterSpacing: "0.12em", textTransform: "uppercase" }}>Infrastructure Operations Center · IOC</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>ภาพรวม {periodLabel}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { v: compliancePct + "%", l: "Compliance",    c: compliancePct >= 90 ? "#86efac" : compliancePct >= 70 ? "#fde68a" : "#fca5a5" },
                { v: s.completedCount,    l: "ตรวจแล้ว",      c: "#e0f2fe" },
                { v: s.totalIssues,       l: "ผิดปกติ",       c: s.totalIssues > 0 ? "#fca5a5" : "#86efac" },
                { v: s.dataCenterCount,   l: "Data Center",   c: "#e0e7ff" },
              ].map((x) => (
                <div key={x.l} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#a5b4fc", fontWeight: 700 }}>{x.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: x.c }}>{x.v}</div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Link href="/" style={{ fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "#e0e7ff", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
                  <RefreshCcw size={13} /> ล้าง
                </Link>
                <a href={exportHref} style={{ fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 8, border: "none", background: "#fff", color: "#4f46e5", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
                  <Download size={13} /> CSV
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── Mode Tabs + Filter ── */}
        <div style={{ background: "#fff", borderBottom: "2px solid #e2e8f0", padding: "0 28px" }}>
          <div style={{ display: "flex", gap: 0 }}>
            {[{ href: dailyHref, label: "รายวัน", active: filters.mode === "daily" },
              { href: monthlyHref, label: "รายเดือน", active: filters.mode === "monthly" }].map((t) => (
              <Link key={t.label} href={t.href} style={{ padding: "10px 20px", fontSize: 13, fontWeight: 700, color: t.active ? C.indigo : "#64748b", borderBottom: t.active ? `2px solid ${C.indigo}` : "2px solid transparent", textDecoration: "none", marginBottom: -2 }}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "12px 28px" }}>
          <form method="get">
            <input type="hidden" name="mode" value={filters.mode} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              {filters.mode === "daily" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.blue, textTransform: "uppercase" }}>📅 วันที่</label>
                  <select name="day" defaultValue={filters.day} style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#fff", color: "#1e293b", fontWeight: 600 }}>
                    {Array.from({ length: filters.maxDay }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </select>
                </div>
              )}
              {[
                { name: "month", label: "📅 เดือน", defaultValue: String(filters.month), opts: Array.from({ length: 12 }, (_, i) => ({ v: String(i + 1), l: String(i + 1) })) },
              ].map((f) => (
                <div key={f.name} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.teal, textTransform: "uppercase" }}>{f.label}</label>
                  <select name={f.name} defaultValue={f.defaultValue} style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#fff", color: "#1e293b", fontWeight: 600 }}>
                    {f.opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              ))}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.teal, textTransform: "uppercase" }}>ปี พ.ศ.</label>
                <input name="buddhistYear" type="number" defaultValue={filters.buddhistYear} style={{ fontSize: 13, padding: "0 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#fff", color: "#1e293b", width: 76, fontWeight: 600, height: 33, boxSizing: "border-box", display: "block" } as React.CSSProperties} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.purple, textTransform: "uppercase" }}>🏢 Data Center</label>
                <select name="dataCenterId" defaultValue={filters.dataCenterId} style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#fff", color: "#1e293b", fontWeight: 600 }}>
                  <option value="all">ทั้งหมด</option>
                  {data.dataCenters.map((dc) => <option key={dc.id} value={dc.id}>{dc.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.orange, textTransform: "uppercase" }}>📁 หมวดงาน</label>
                <select name="category" defaultValue={filters.category} style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#fff", color: "#1e293b", fontWeight: 600 }}>
                  <option value="all">ทั้งหมด</option>
                  {data.categories.map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.orange, textTransform: "uppercase" }}>🖥 Asset</label>
                <select name="assetId" defaultValue={filters.assetId} style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#fff", color: "#1e293b", fontWeight: 600 }}>
                  <option value="all">ทั้งหมด</option>
                  {data.assetOptions.map((a) => <option key={a.id} value={a.id}>{a.category.name} – {a.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.green, textTransform: "uppercase" }}>🔄 เวร</label>
                <select name="shift" defaultValue={filters.shift} style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#fff", color: "#1e293b", fontWeight: 600 }}>
                  <option value="all">ทั้งหมด</option>
                  {inspectionShiftOrder.map((s) => <option key={s} value={s}>{inspectionShiftLabels[s]}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: "uppercase" }}>⚠ สถานะ</label>
                <select name="status" defaultValue={filters.status} style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#fff", color: "#1e293b", fontWeight: 600 }}>
                  {data.statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <button type="submit" style={{ fontSize: 13, fontWeight: 800, padding: "8px 22px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-end", boxShadow: "0 2px 8px rgba(79,70,229,0.4)" }}>
                <Filter size={14} /> แสดงข้อมูล
              </button>
            </div>
          </form>
        </div>

        {!data.hasReport && (
          <div style={{ background: "#fef3c7", borderBottom: "1px solid #fde68a", padding: "10px 28px", display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#92400e" }}>
            <AlertTriangle size={15} /> ยังไม่มีรายงานประจำเดือนนี้ ข้อมูลสถานะทรัพย์สินจะว่างจนกว่าจะมีการบันทึกจริงในระบบ
          </div>
        )}

        <div style={{ padding: "20px 24px 0" }}>

          {/* ══ 1. Executive Summary KPIs ══ */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <SectionBadge emoji="📊" label="Executive Summary" color={C.indigo} bg="#e0e7ff" />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>ภาพรวมงานตรวจสอบสำหรับผู้บริหาร · {periodLabel}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 12 }}>
              <KCard label="Data Center"      value={s.dataCenterCount}           sub="พื้นที่เปิดใช้งาน"                       icon={<Database size={18} />}    color={C.blue} />
              <KCard label="Asset"            value={s.assetCount}                sub="ทรัพย์สินในขอบเขต"                       icon={<Server size={18} />}      color={C.teal} />
              <KCard label="รอบตรวจ"          value={kpi.inspectionRoundCount}    sub={`รายการ ${kpi.checkedCount}`}             icon={<RefreshCcw size={18} />}  color={C.green} />
              <KCard label="ปกติ"             value={s.inspectionNormalCount}     sub={`จากรายการตรวจ ${s.inspectionResultCount}`} icon={<CheckCircle2 size={18} />} color="#059669" />
              <KCard label="Warning"          value={s.warningCount}              sub="รวมทุกแหล่งข้อมูล"                       icon={<AlertTriangle size={18} />} color={C.orange} />
              <KCard label="Critical"         value={s.criticalCount}             sub="สถานะวิกฤต"                               icon={<Zap size={18} />}         color={C.red} />
              <KCard label="Compliance"       value={`${compliancePct}%`}         sub={`ตรวจแล้ว ${s.completedCount} รายการ`}   icon={<ShieldCheck size={18} />} color={pctColor(compliancePct)} />
              <KCard label="เวลาตรวจรวม"      value={`${Math.floor(kpi.totalInspectionMinutes / 60)}ช ${kpi.totalInspectionMinutes % 60}น`} sub="SUM ระยะเวลาแต่ละรอบ" icon={<Activity size={18} />} color={C.purple} />
            </div>
          </div>

          {/* ══ 1b. Mission Progress ══ */}
          {(() => {
            const mp = data.missionProgress;
            if (!mp.hasPolicies) return (
              <div style={{ background: "#fff", borderRadius: 14, border: "2px dashed #e2e8f0", padding: "28px 24px", marginBottom: 20, textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>ยังไม่มี Inspection Policy</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>กรุณาตั้งค่า Inspection Policy ก่อน เพื่อให้ระบบคำนวณ Mission Progress ได้ถูกต้อง</div>
                <a href="/admin/inspection-policy" style={{ fontSize: 12, fontWeight: 700, padding: "8px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  ⚙ ตั้งค่า Inspection Policy
                </a>
              </div>
            );

            const SHIFT_LABEL: Record<string, string> = {
              ALL: "ทุกเวร", OFFICE_HOURS: "เวลาราชการ",
              MORNING_SHIFT: "เวรเช้า", AFTERNOON_SHIFT: "เวรบ่าย", NIGHT_SHIFT: "เวรดึก"
            };
            const SHIFT_COLOR: Record<string, string> = {
              ALL: "#4f46e5", OFFICE_HOURS: "#2563eb",
              MORNING_SHIFT: "#059669", AFTERNOON_SHIFT: "#d97706", NIGHT_SHIFT: "#7c3aed"
            };

            return (
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #e0e7ff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <SectionBadge emoji="🎯" label="Mission Progress" color={C.indigo} bg="#e0e7ff" />
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                      {filters.mode === "daily" ? `วันที่ ${periodLabel}` : periodLabel}
                      {" · "}{mp.dcCount} DC · จาก Inspection Policy
                    </span>
                  </div>
                  {/* Overall pill */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>รวม {mp.totalDone}/{mp.totalRequired} รอบ</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: pctColor(mp.totalPct) }}>{mp.totalPct}%</span>
                    <div style={{ width: 80, height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${mp.totalPct}%`, background: pctColor(mp.totalPct), borderRadius: 99, transition: "width .4s" }} />
                    </div>
                  </div>
                </div>

                {/* Policy rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {mp.policies.map((p) => {
                    const col = pctColor(p.pct);
                    const shifts = p.requiredShifts === "ALL"
                      ? ["ALL"]
                      : p.requiredShifts.split(",").map((s: string) => s.trim()).filter(Boolean);
                    return (
                      <div key={p.policyId} style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 12, alignItems: "center", borderBottom: "1px solid #f8fafc", paddingBottom: 8 }}>
                        {/* Left: label + shifts */}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{p.categoryLabel}</div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {shifts.map((sk: string) => (
                              <span key={sk} style={{ fontSize: 10, fontWeight: 700, background: `${SHIFT_COLOR[sk] ?? "#475569"}18`, color: SHIFT_COLOR[sk] ?? "#475569", border: `1px solid ${SHIFT_COLOR[sk] ?? "#475569"}33`, padding: "1px 7px", borderRadius: 99 }}>
                                {SHIFT_LABEL[sk] ?? sk}
                              </span>
                            ))}
                          </div>
                        </div>
                        {/* Center: progress bar */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: "#64748b" }}>
                              {p.minRoundsPerDay} รอบ/วัน{p.categoryKey !== "DC_ROOM" ? "" : ` × ${mp.dcCount} DC`}
                            </span>
                            <span style={{ fontSize: 11, color: "#64748b" }}>
                              ตรวจแล้ว {p.done} / {p.required} รอบ
                              {p.remaining > 0 && <span style={{ color: C.orange, fontWeight: 700 }}> · เหลือ {p.remaining}</span>}
                            </span>
                          </div>
                          <PBar pct={p.pct} color={col} />
                        </div>
                        {/* Right: pct badge */}
                        <div style={{ textAlign: "right", minWidth: 44 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: col }}>{p.pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ══ 2. Operational Status ══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Infrastructure Progress */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #eff6ff" }}>
                <SectionBadge emoji="⚙️" label="Operational Status" color={C.blue} bg="#eff6ff" />
              </div>
              {data.infrastructureDashboard.length === 0 ? (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>ไม่มีข้อมูล</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {data.infrastructureDashboard.map((cat) => (
                    <div key={cat.code}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{cat.label}</span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {cat.warning > 0 && <span style={{ fontSize: 10, fontWeight: 800, background: "#fef3c7", color: C.orange, padding: "1px 7px", borderRadius: 99 }}>W {cat.warning}</span>}
                          {cat.critical > 0 && <span style={{ fontSize: 10, fontWeight: 800, background: "#fee2e2", color: C.red, padding: "1px 7px", borderRadius: 99 }}>C {cat.critical}</span>}
                          <span style={{ fontSize: 12, fontWeight: 700, color: pctColor(cat.progressPct) }}>{cat.progressPct}%</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <PBar pct={cat.progressPct} color={pctColor(cat.progressPct)} />
                        <span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" }}>{cat.recorded}/{cat.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Environment per DC */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #f0fdf4" }}>
                <SectionBadge emoji="🌡" label="Environment Status" color={C.green} bg="#dcfce7" />
              </div>
              {data.environmentDashboard.length === 0 ? (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>ไม่มีข้อมูล</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.environmentDashboard.map((dc) => (
                    <div key={dc.id} style={{ borderRadius: 10, border: "1px solid #e2e8f0", padding: "10px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>{dc.name}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                        {dc.shifts.map((sh) => {
                          const bg = sh.status === "NORMAL" ? "#dcfce7" : sh.status === "WARNING" ? "#fef3c7" : sh.status === "PENDING" ? "#f8fafc" : "#fee2e2";
                          const col = sh.status === "NORMAL" ? C.green : sh.status === "WARNING" ? C.orange : sh.status === "PENDING" ? "#94a3b8" : C.red;
                          return (
                            <div key={sh.shift} style={{ background: bg, borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: col }}>{sh.label}</div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: col }}>{sh.status === "PENDING" ? "—" : sh.status === "NORMAL" ? "✓" : "⚠"}</div>
                              <div style={{ fontSize: 9, color: col, opacity: 0.8 }}>{sh.inspectorName === "-" ? "ยังไม่ตรวจ" : sh.inspectorName}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ══ 3. Workload Dashboard ══ */}
          {data.kpiDashboard.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #f5f3ff" }}>
                <SectionBadge emoji="👥" label="Workload Dashboard" color={C.purple} bg="#f5f3ff" />
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Personal workload · Team distribution</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["#","ผู้ดูแล","งาน","รอบตรวจ","รายการ","เวลาเฉลี่ย/รอบ","Warning","Critical","สัดส่วน"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: h === "#" ? "center" : "left", fontWeight: 700, color: "#475569", fontSize: 11, whiteSpace: "nowrap", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.kpiDashboard.map((kpi, i) => {
                      const maxWork = data.kpiDashboard[0]?.workCount || 1;
                      return (
                        <tr key={kpi.inspectorName} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: i === 0 ? "#fef3c7" : i === 1 ? "#f1f5f9" : "#f8fafc", fontSize: 11, fontWeight: 800, color: i === 0 ? C.orange : "#64748b" }}>{i + 1}</span>
                          </td>
                          <td style={{ padding: "8px 10px", fontWeight: 700, color: "#1e293b" }}>{kpi.inspectorName}</td>
                          <td style={{ padding: "8px 10px", color: C.blue, fontWeight: 700 }}>{kpi.workCount}</td>
                          <td style={{ padding: "8px 10px", color: C.teal }}>{kpi.inspectionRounds}</td>
                          <td style={{ padding: "8px 10px", color: "#475569" }}>{kpi.assetCount}</td>
                          <td style={{ padding: "8px 10px", color: C.purple }}>{kpi.averageDurationMin > 0 ? `${kpi.averageDurationMin} นาที` : "—"}</td>
                          <td style={{ padding: "8px 10px" }}>{kpi.warning > 0 ? <span style={{ color: C.orange, fontWeight: 700 }}>{kpi.warning}</span> : <span style={{ color: "#94a3b8" }}>0</span>}</td>
                          <td style={{ padding: "8px 10px" }}>{kpi.critical > 0 ? <span style={{ color: C.red, fontWeight: 700 }}>{kpi.critical}</span> : <span style={{ color: "#94a3b8" }}>0</span>}</td>
                          <td style={{ padding: "8px 10px", minWidth: 100 }}>
                            <PBar pct={Math.round((kpi.workCount / maxWork) * 100)} color={C.indigo} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ 4. Trend Analytics ══ */}
          {data.trendData.length > 1 && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #eff6ff" }}>
                <SectionBadge emoji="📈" label="Trend Analytics" color={C.blue} bg="#eff6ff" />
                <span style={{ fontSize: 11, color: "#94a3b8" }}>รายการตรวจ · Incident · Compliance รายวันในช่วงที่เลือก</span>
              </div>
              <OperationsTrendChart data={data.trendData} />
            </div>
          )}

          {/* ══ 5. Environment Trend (Resource) ══ */}
          {data.resourceTrend.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #f0fdf4" }}>
                <SectionBadge emoji="🌡" label="Environment Trend" color={C.green} bg="#dcfce7" />
                <span style={{ fontSize: 11, color: "#94a3b8" }}>CPU · RAM · Disk เฉลี่ยรายวัน</span>
              </div>
              <ResourceAverageChart data={data.resourceTrend} />
            </div>
          )}

          {/* ══ 6. Operations Timeline ══ */}
          {data.topIssues.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #e0f2fe" }}>
                <SectionBadge emoji="🕐" label="Operations Timeline" color={C.teal} bg="#e0f2fe" />
                <span style={{ fontSize: 11, color: "#94a3b8" }}>กิจกรรมล่าสุด {data.topIssues.length} รายการ (เฉพาะผิดปกติ)</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["แหล่งข้อมูล","หมวด","รายการ","สถานะ","หมายเหตุ","อัปเดต"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11, whiteSpace: "nowrap", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.topIssues.slice(0, 20).map((issue, i) => {
                      const tone = issue.status.includes("วิกฤต") || issue.status.includes("ผิดปกติ") || issue.status.includes("ล่ม") ? C.red : C.orange;
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                          <td style={{ padding: "7px 10px" }}><span style={{ fontSize: 10, background: "#f1f5f9", color: "#475569", padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap" }}>{issue.source}</span></td>
                          <td style={{ padding: "7px 10px", color: "#64748b" }}>{issue.category}</td>
                          <td style={{ padding: "7px 10px", fontWeight: 700, color: "#1e293b" }}>{issue.title}</td>
                          <td style={{ padding: "7px 10px" }}><span style={{ fontSize: 11, fontWeight: 700, color: tone, background: `${tone}14`, padding: "2px 8px", borderRadius: 99 }}>{issue.status}</span></td>
                          <td style={{ padding: "7px 10px", color: "#64748b", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{issue.note || "—"}</td>
                          <td style={{ padding: "7px 10px", color: "#94a3b8", whiteSpace: "nowrap" }}>{issue.updatedAt.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ 7. Incident Dashboard ══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Warning & Critical counts per shift */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #fee2e2" }}>
                <SectionBadge emoji="🔴" label="Incident Dashboard" color={C.red} bg="#fee2e2" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ background: "#fef3c7", borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.orange }}>⚠ Warning</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.orange }}>{s.warningCount}</div>
                  <div style={{ fontSize: 10, color: "#92400e" }}>รายการ</div>
                </div>
                <div style={{ background: "#fee2e2", borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.red }}>🚨 Critical</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.red }}>{s.criticalCount}</div>
                  <div style={{ fontSize: 10, color: "#7f1d1d" }}>รายการ</div>
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 8 }}>สรุปตามเวร</div>
              {data.shiftSummary.map((sh) => (
                <div key={sh.shift} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#1e293b", fontWeight: 600, minWidth: 80 }}>{sh.label}</span>
                  <PBar pct={sh.inspections > 0 ? Math.round((sh.normal / (sh.normal + sh.abnormal || 1)) * 100) : 0} color={C.green} />
                  <span style={{ fontSize: 10, color: C.orange, whiteSpace: "nowrap" }}>W {sh.statusIssues}</span>
                  <span style={{ fontSize: 10, color: C.red, whiteSpace: "nowrap" }}>A {sh.abnormal}</span>
                </div>
              ))}
            </div>

            {/* Status by category table */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #e0e7ff" }}>
                <SectionBadge emoji="📋" label="สรุปสถานะ Asset" color={C.indigo} bg="#e0e7ff" />
              </div>
              {data.statusByCategory.length > 0 ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11, borderBottom: "2px solid #e2e8f0" }}>หมวด</th>
                        <th style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: "#475569", fontSize: 11, borderBottom: "2px solid #e2e8f0" }}>รวม</th>
                        <th style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: "#475569", fontSize: 11, borderBottom: "2px solid #e2e8f0" }}>บันทึก</th>
                        {(data.statusByCategory[0]?.codes ?? []).map((code) => (
                          <th key={code} style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: "#475569", fontSize: 11, borderBottom: "2px solid #e2e8f0" }}>{code}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.statusByCategory.map((cat, i) => (
                        <tr key={cat.code} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                          <td style={{ padding: "7px 10px", fontWeight: 700, color: "#1e293b" }}>{cat.label}</td>
                          <td style={{ padding: "7px 10px", textAlign: "center", color: "#64748b" }}>{cat.total}</td>
                          <td style={{ padding: "7px 10px", textAlign: "center", color: C.blue, fontWeight: 700 }}>{cat.recorded}</td>
                          {cat.codes.map((code) => (
                            <td key={code} style={{ padding: "7px 10px", textAlign: "center", color: code === "N" ? C.green : code === "F" || code === "D" ? C.red : C.orange, fontWeight: (cat.statusCounts[code] || 0) > 0 ? 700 : 400 }}>
                              {cat.statusCounts[code] || 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: 24, fontSize: 13 }}>ไม่มีข้อมูลในช่วงที่เลือก</div>
              )}
            </div>
          </div>

          {/* ══ 8. Analytics: Top Assets + Top Inspectors ══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Top 10 Asset ที่พบปัญหา */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #fee2e2" }}>
                <SectionBadge emoji="🔥" label="Top Asset พบปัญหา" color={C.red} bg="#fee2e2" />
              </div>
              {data.topIssues.length === 0 ? (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}><div style={{ fontSize: 24 }}>✓</div>ไม่พบปัญหาในช่วงนี้</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {Array.from(
                    data.topIssues.reduce((m, x) => { m.set(x.title, (m.get(x.title) || 0) + 1); return m; }, new Map<string, number>())
                  ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([title, cnt], i) => (
                    <div key={title} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: i < 3 ? "#fff5f5" : "#fafbfc", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: i < 3 ? C.red : "#e2e8f0", color: i < 3 ? "#fff" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{title}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: C.red }}>{cnt} ครั้ง</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Inspectors */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #dcfce7" }}>
                <SectionBadge emoji="🏆" label="Top Inspectors" color={C.green} bg="#dcfce7" />
              </div>
              {data.kpiDashboard.length === 0 ? (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}>ไม่มีข้อมูล</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.kpiDashboard.slice(0, 10).map((kpi, i) => {
                    const maxWork = data.kpiDashboard[0]?.workCount || 1;
                    return (
                      <div key={kpi.inspectorName} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: i === 0 ? "#f0fdf4" : "#fafbfc", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                        <span style={{ width: 20, height: 20, borderRadius: "50%", background: i === 0 ? "#fef3c7" : "#e2e8f0", color: i === 0 ? C.orange : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{kpi.inspectorName}</span>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{kpi.workCount} งาน</span>
                        <div style={{ width: 60 }}><PBar pct={Math.round((kpi.workCount / maxWork) * 100)} color={C.green} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ══ 9. Raw Data Table (collapsible) ══ */}
          {data.rawRows.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #f8fafc" }}>
                <SectionBadge emoji="📄" label="ข้อมูลดิบทั้งหมด" color={C.slate} bg="#f1f5f9" />
                <span style={{ fontSize: 11, color: "#94a3b8" }}>แสดง {Math.min(50, data.rawRows.length)} จาก {data.rawRows.length} รายการ · <a href={exportHref} style={{ color: C.blue, textDecoration: "none", fontWeight: 700 }}>ดาวน์โหลด CSV</a></span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["วันที่","แหล่งข้อมูล","หมวด","รายการ","สถานะ","ผู้บันทึก","เวร","รายละเอียด"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11, borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rawRows.slice(0, 50).map((row, i) => {
                      const tone = statusTone(row.status);
                      const pillBg = tone === "danger" ? "#fee2e2" : tone === "warning" ? "#fef3c7" : "#f0fdf4";
                      const pillCol = tone === "danger" ? C.red : tone === "warning" ? C.orange : C.green;
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                          <td style={{ padding: "7px 10px", color: "#64748b", whiteSpace: "nowrap" }}>{row.date}</td>
                          <td style={{ padding: "7px 10px" }}><span style={{ fontSize: 10, background: "#f1f5f9", color: "#475569", padding: "2px 6px", borderRadius: 99 }}>{row.source}</span></td>
                          <td style={{ padding: "7px 10px", color: "#64748b" }}>{row.category}</td>
                          <td style={{ padding: "7px 10px", fontWeight: 600, color: "#1e293b" }}>{row.item}{row.dataCenter ? <div style={{ fontSize: 10, color: "#94a3b8" }}>{row.dataCenter}</div> : null}</td>
                          <td style={{ padding: "7px 10px" }}><span style={{ fontSize: 11, fontWeight: 700, color: pillCol, background: pillBg, padding: "2px 8px", borderRadius: 99 }}>{row.status}</span></td>
                          <td style={{ padding: "7px 10px", color: "#475569" }}>{row.operator || "—"}</td>
                          <td style={{ padding: "7px 10px", color: "#64748b" }}>{row.shift || "—"}</td>
                          <td style={{ padding: "7px 10px", color: "#64748b", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.note || row.cpu || row.ram || row.disk || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </AppShell>
  );
}
