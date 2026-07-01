import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  getEnvSummary, getEnvTrend, getEnvHeatmap,
  getChecklistAnalytics, getTopIncidents, getTimeline,
  getCalendar, getDcComparison, getInspectors,
  type EnvFilter,
} from "@/lib/env-analytics";

const SHIFT_LABELS: Record<string, string> = {
  OFFICE_HOURS: "เวลาทำการ", MORNING_SHIFT: "เวรเช้า", AFTERNOON_SHIFT: "เวรบ่าย", NIGHT_SHIFT: "เวรดึก"
};
const SHIFT_COLORS: Record<string, string> = {
  OFFICE_HOURS: "#2563eb", MORNING_SHIFT: "#f59e0b", AFTERNOON_SHIFT: "#10b981", NIGHT_SHIFT: "#7c3aed"
};
const SHIFTS = ["OFFICE_HOURS", "MORNING_SHIFT", "AFTERNOON_SHIFT", "NIGHT_SHIFT"];

function statusColor(s: string) {
  if (s === "normal")   return "#059669";
  if (s === "warning")  return "#d97706";
  if (s === "critical") return "#dc2626";
  return "#e2e8f0";
}
function statusBg(s: string) {
  if (s === "normal")   return "#dcfce7";
  if (s === "warning")  return "#fef3c7";
  if (s === "critical") return "#fee2e2";
  return "#f8fafc";
}
function complianceColor(pct: number) {
  if (pct >= 90) return "#059669";
  if (pct >= 70) return "#d97706";
  return "#dc2626";
}

export default async function EnvAnalyticsPage(
  props: {
    searchParams: Promise<{
      dataCenterId?: string; startDate?: string; endDate?: string;
      shift?: string; inspector?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  await requireUser();

  const dataCenters = await prisma.dataCenter.findMany({
    where: { active: true }, orderBy: { displayOrder: "asc" }
  });

  const selectedDcId = searchParams.dataCenterId || dataCenters[0]?.id || "";
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const startDate = searchParams.startDate || firstOfMonth;
  const endDate   = searchParams.endDate   || new Date().toISOString().slice(0, 10);
  const selShift  = searchParams.shift     || "ALL";
  const selInspector = searchParams.inspector || "ALL";

  const filter: EnvFilter = {
    dataCenterId: selectedDcId, startDate, endDate,
    shift: selShift === "ALL" ? undefined : selShift,
    inspector: selInspector === "ALL" ? undefined : selInspector,
  };

  const [summary, trend, heatmap, checklistStats, incidents, timeline, calendar, dcComparison, inspectors] = await Promise.all([
    getEnvSummary(filter),
    getEnvTrend(filter),
    getEnvHeatmap(filter),
    getChecklistAnalytics(filter),
    getTopIncidents(filter, 8),
    getTimeline(filter, 25),
    getCalendar(filter),
    getDcComparison({ startDate, endDate }),
    getInspectors(selectedDcId),
  ]);

  const selectedDc = dataCenters.find((d) => d.id === selectedDcId);
  const healthScore = summary.checklistCount > 0
    ? Math.round((summary.normalCount / summary.checklistCount) * 100)
    : 0;

  // Sparkline helper — tiny inline SVG bar chart
  const sparkline = (points: (number | null)[], color: string, h = 32, w = 120) => {
    const vals = points.map((v) => v ?? 0);
    if (vals.length < 2) return null;
    const min = Math.min(...vals); const max = Math.max(...vals);
    const range = max - min || 1;
    const pts = vals.map((v, i) => {
      const x = Math.round((i / (vals.length - 1)) * w);
      const y = Math.round(h - ((v - min) / range) * (h - 4) - 2);
      return `${x},${y}`;
    }).join(" ");
    return (
      <svg width={w} height={h} style={{ display: "block" }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <AppShell>
      <div style={{ padding: "0 0 32px" }}>

        {/* ── Hero TopBar ── */}
        <div style={{ background: "linear-gradient(135deg,#1e3a8a 0%,#4f46e5 50%,#7c3aed 100%)", padding: "18px 28px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏢</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#a5b4fc", letterSpacing: "0.12em", textTransform: "uppercase" }}>Environment Analytics Dashboard</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{selectedDc?.name ?? "ทุก Data Center"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#a5b4fc", fontWeight: 700 }}>Compliance</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: summary.compliancePct >= 90 ? "#86efac" : summary.compliancePct >= 70 ? "#fde68a" : "#fca5a5" }}>{summary.compliancePct}%</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#a5b4fc", fontWeight: 700 }}>รอบตรวจ</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{summary.inspectionCount}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#a5b4fc", fontWeight: 700 }}>ผิดปกติ</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: summary.abnormalCount > 0 ? "#fca5a5" : "#86efac" }}>{summary.abnormalCount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div style={{ background: "#fff", borderBottom: "2px solid #e2e8f0", padding: "12px 28px", marginBottom: 20 }}>
          <form method="get">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>🏢 Data Center</label>
                <select name="dataCenterId" defaultValue={selectedDcId} style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#f8fafc", color: "#1e293b", fontWeight: 600 }}>
                  {dataCenters.map((dc) => <option key={dc.id} value={dc.id}>{dc.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#0891b2", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>📅 วันที่เริ่ม</label>
                <input type="date" name="startDate" defaultValue={startDate} style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#f8fafc", color: "#1e293b", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#0891b2", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>📅 วันที่สิ้นสุด</label>
                <input type="date" name="endDate" defaultValue={endDate} style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#f8fafc", color: "#1e293b", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>🔄 เวร</label>
                <select name="shift" defaultValue={selShift} style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#f8fafc", color: "#1e293b", fontWeight: 600 }}>
                  <option value="ALL">ทุกเวร</option>
                  {SHIFTS.map((s) => <option key={s} value={s}>{SHIFT_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>👤 ผู้ตรวจ</label>
                <select name="inspector" defaultValue={selInspector} style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#f8fafc", color: "#1e293b", fontWeight: 600 }}>
                  <option value="ALL">ทุกคน</option>
                  {inspectors.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button type="submit" style={{ fontSize: 13, fontWeight: 800, padding: "9px 24px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(79,70,229,0.4)" }}>
                🔍 ค้นหา
              </button>
            </div>
          </form>
        </div>

        <div style={{ padding: "0 20px" }}>

          {/* ── Section 1: Executive Summary ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "รอบตรวจ",        value: summary.inspectionCount, unit: "รอบ",  color: "#2563eb", bg: "#eff6ff" },
              { label: "จำนวน Checklist", value: summary.checklistCount,  unit: "ราย",  color: "#0891b2", bg: "#e0f2fe" },
              { label: "ปกติ",            value: summary.normalCount,     unit: "ราย",  color: "#059669", bg: "#dcfce7" },
              { label: "ผิดปกติ",         value: summary.abnormalCount,   unit: "ราย",  color: "#dc2626", bg: "#fee2e2" },
              { label: "Compliance",      value: `${summary.compliancePct}%`, unit: "",  color: complianceColor(summary.compliancePct), bg: "#f8fafc" },
              { label: "เวลาตรวจรวม",    value: summary.totalDurationMin > 0 ? `${Math.floor(summary.totalDurationMin / 60)}ช ${summary.totalDurationMin % 60}น` : "—", unit: "", color: "#7c3aed", bg: "#f5f3ff" },
            ].map((item) => (
              <div key={item.label} style={{ background: item.bg, borderRadius: 12, padding: "12px 14px", border: `1px solid ${item.color}22` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}<span style={{ fontSize: 11, fontWeight: 500 }}>{item.unit ? ` ${item.unit}` : ""}</span></div>
              </div>
            ))}
          </div>

          {/* ── Section 2 + 3: Health Gauge + Trend ── */}
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, marginBottom: 24 }}>

            {/* Environment Health */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #f0fdf4" }}><span style={{ background: "#dcfce7", color: "#059669", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 800 }}>🌡 Environment Health</span></div>
              {/* Gauge visual */}
              <div style={{ position: "relative", textAlign: "center", marginBottom: 16 }}>
                <svg viewBox="0 0 120 70" width="100%" style={{ maxWidth: 180, margin: "0 auto", display: "block" }}>
                  <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
                  <path d="M10 65 A50 50 0 0 1 110 65" fill="none"
                    stroke={complianceColor(healthScore)}
                    strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${Math.round((healthScore / 100) * 157)} 157`}
                  />
                  <text x="60" y="60" textAnchor="middle" fontSize="18" fontWeight="800" fill={complianceColor(healthScore)}>{healthScore}%</text>
                </svg>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>อุณหภูมิเฉลี่ย</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#059669" }}>
                    {summary.avgTemp !== null ? `${summary.avgTemp}°C` : "—"}
                  </div>
                </div>
                <div style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>ความชื้นเฉลี่ย</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#2563eb" }}>
                    {summary.avgHumidity !== null ? `${summary.avgHumidity}%` : "—"}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12, padding: "6px 10px", borderRadius: 8, background: statusBg(healthScore >= 90 ? "normal" : healthScore >= 70 ? "warning" : "critical"), textAlign: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: complianceColor(healthScore) }}>
                  {healthScore >= 90 ? "✓ สภาพแวดล้อมดี" : healthScore >= 70 ? "⚠ ต้องติดตาม" : "✗ พบปัญหา"}
                </span>
              </div>
            </div>

            {/* Trend Chart */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ background: "#eff6ff", color: "#2563eb", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 800 }}>📈 Trend: อุณหภูมิ & ความชื้น รายวัน</span></div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>เส้นสีแดง = อุณหภูมิ · เส้นสีน้ำเงิน = ความชื้น</div>
              {trend.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>ไม่มีข้อมูลในช่วงนี้</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  {/* Inline SVG trend chart */}
                  {(() => {
                    const W = 600; const H = 120; const PAD = 28;
                    const temps = trend.map((p) => p.avgTemp);
                    const hums  = trend.map((p) => p.avgHumidity);
                    const allVals = [...temps, ...hums].filter((v): v is number => v !== null);
                    if (allVals.length === 0) return <div style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>ไม่มีข้อมูลอุณหภูมิ/ความชื้น</div>;
                    const minV = Math.min(...allVals); const maxV = Math.max(...allVals);
                    const range = maxV - minV || 1;
                    const n = trend.length;
                    const toX = (i: number) => PAD + Math.round((i / (n - 1 || 1)) * (W - PAD * 2));
                    const toY = (v: number) => H - PAD - Math.round(((v - minV) / range) * (H - PAD * 2));
                    const polyPoints = (vals: (number | null)[]) =>
                      vals.map((v, i) => v !== null ? `${toX(i)},${toY(v)}` : null).filter(Boolean).join(" ");
                    const tPts = polyPoints(temps);
                    const hPts = polyPoints(hums);
                    // pick every N-th label to avoid crowding
                    const step = Math.max(1, Math.ceil(n / 10));
                    return (
                      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", minWidth: 300 }}>
                        {/* grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((r) => {
                          const y = PAD + Math.round(r * (H - PAD * 2));
                          return <line key={r} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#f1f5f9" strokeWidth="1" />;
                        })}
                        {/* x labels */}
                        {trend.filter((_, i) => i % step === 0).map((p, idx) => {
                          const origIdx = idx * step;
                          return <text key={p.isoDate} x={toX(origIdx)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">{p.dateLabel}</text>;
                        })}
                        {tPts && <polyline points={tPts} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />}
                        {hPts && <polyline points={hPts} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />}
                        {/* dots */}
                        {temps.map((v, i) => v !== null ? <circle key={i} cx={toX(i)} cy={toY(v)} r="3" fill="#ef4444" /> : null)}
                        {hums.map((v, i) => v !== null ? <circle key={i} cx={toX(i)} cy={toY(v)} r="3" fill="#2563eb" /> : null)}
                      </svg>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* ── Section 4: Timeline + Calendar ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 20 }}>

            {/* Timeline */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #e0f2fe" }}><span style={{ background: "#e0f2fe", color: "#0891b2", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 800 }}>🕐 Timeline การตรวจ</span></div>
              {timeline.length === 0 ? (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>ไม่มีข้อมูล</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                        {["วันที่", "เวลา", "เวร", "ผู้ตรวจ", "ผล", "Checklist"].map((h) => (
                          <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontWeight: 700, color: "#475569", whiteSpace: "nowrap", fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.map((entry, idx) => (
                        <tr key={entry.id} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#fff" : "#fafbfc" }}>
                          <td style={{ padding: "7px 10px", color: "#475569", whiteSpace: "nowrap" }}>{entry.dateLabel}</td>
                          <td style={{ padding: "7px 10px", color: "#94a3b8" }}>{entry.timeLabel}</td>
                          <td style={{ padding: "7px 10px", color: "#475569", whiteSpace: "nowrap" }}>{entry.shift}</td>
                          <td style={{ padding: "7px 10px", color: "#1e293b", fontWeight: 600 }}>{entry.inspector}</td>
                          <td style={{ padding: "7px 10px" }}>
                            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: statusBg(entry.status), color: statusColor(entry.status) }}>
                              {entry.status === "normal" ? "ปกติ" : entry.status === "warning" ? "พบปัญหาเล็กน้อย" : "พบปัญหา"}
                            </span>
                          </td>
                          <td style={{ padding: "7px 10px", color: "#475569" }}>
                            {entry.total - entry.abnormal}/{entry.total}
                            {entry.abnormal > 0 && <span style={{ color: "#dc2626", fontWeight: 700 }}> ({entry.abnormal} ผิดปกติ)</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Calendar */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: "2px solid #fef3c7" }}><span style={{ background: "#fef3c7", color: "#d97706", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 800 }}>📅 Calendar สถานะรายวัน</span></div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                {[["normal","✓ ปกติ"],["warning","⚠ พบปัญหา"],["critical","✗ หนัก"],["none","ไม่ได้ตรวจ"]].map(([s, label]) => (
                  <span key={s} style={{ fontSize: 10, color: statusColor(s), fontWeight: 700 }}>{label}</span>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                {["อา","จ","อ","พ","พฤ","ศ","ส"].map((d) => (
                  <div key={d} style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, textAlign: "center", paddingBottom: 2 }}>{d}</div>
                ))}
                {(() => {
                  if (calendar.length === 0) return null;
                  const firstDay = new Date(calendar[0].isoDate).getDay();
                  const blanks = Array.from({ length: firstDay }, (_, i) => (
                    <div key={`b${i}`} />
                  ));
                  return [
                    ...blanks,
                    ...calendar.map((c) => (
                      <div key={c.isoDate} title={`${c.isoDate}: ${c.inspectionCount} รอบ | ผิดปกติ ${c.abnormalCount}`}
                        style={{ background: statusBg(c.status), border: `1px solid ${statusColor(c.status)}44`, borderRadius: 5, padding: "3px 2px", textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.status === "none" ? "#cbd5e1" : statusColor(c.status) }}>{c.day}</div>
                        {c.status !== "none" && (
                          <div style={{ fontSize: 9, color: statusColor(c.status) }}>
                            {c.status === "normal" ? "✓" : c.status === "warning" ? "⚠" : "✗"}
                          </div>
                        )}
                      </div>
                    ))
                  ];
                })()}
              </div>
            </div>
          </div>

          {/* ── Section 5: DC Comparison ── */}
          {dcComparison.length > 1 && (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #e0e7ff" }}><span style={{ background: "#e0e7ff", color: "#4f46e5", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 800 }}>🏢 Data Center Comparison</span></div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      {["Data Center", "รอบตรวจ", "ผิดปกติ", "อุณหภูมิเฉลี่ย", "ความชื้นเฉลี่ย", "Compliance"].map((h) => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dcComparison.map((dc, idx) => {
                      const compliance = dc.inspectionCount > 0 && dc.abnormalCount >= 0
                        ? 100 : 0;
                      return (
                        <tr key={dc.dcId} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#fff" : "#fafbfc" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 700, color: "#1e293b" }}>{dc.dcName}</td>
                          <td style={{ padding: "8px 12px", color: "#2563eb", fontWeight: 700 }}>{dc.inspectionCount}</td>
                          <td style={{ padding: "8px 12px", color: dc.abnormalCount > 0 ? "#dc2626" : "#059669", fontWeight: 700 }}>{dc.abnormalCount}</td>
                          <td style={{ padding: "8px 12px", color: "#475569" }}>{dc.avgTemp !== null ? `${dc.avgTemp} °C` : "—"}</td>
                          <td style={{ padding: "8px 12px", color: "#475569" }}>{dc.avgHumidity !== null ? `${dc.avgHumidity}%` : "—"}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ flex: 1, height: 5, background: "#f1f5f9", borderRadius: 99, overflow: "hidden", minWidth: 60 }}>
                                <div style={{ height: "100%", width: `${dc.inspectionCount > 0 ? Math.round(((dc.inspectionCount - dc.abnormalCount) / dc.inspectionCount) * 100) : 0}%`, background: "#059669", borderRadius: 99 }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>
                                {dc.inspectionCount > 0 ? `${Math.round(((dc.inspectionCount - dc.abnormalCount) / dc.inspectionCount) * 100)}%` : "—"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Section 6: Heatmap ── */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ background: "#f5f3ff", color: "#7c3aed", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 800 }}>🗓 Heatmap: วัน × เวร</span></div>
            <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
              {[["none","ไม่มีข้อมูล"],["normal","ปกติ"],["warning","พบปัญหาเล็กน้อย"],["critical","พบปัญหาหนัก"]].map(([s, label]) => (
                <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: statusColor(s), display: "inline-block" }} />
                  {label}
                </span>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 80 }} />
                  {SHIFTS.map((s) => <col key={s} />)}
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "8px 12px", color: "#94a3b8", fontWeight: 700, textAlign: "left", fontSize: 12 }}>วัน</th>
                    {SHIFTS.map((s) => (
                      <th key={s} style={{ padding: "8px 12px", color: SHIFT_COLORS[s], fontWeight: 700, textAlign: "center", fontSize: 13 }}>{SHIFT_LABELS[s]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const dates = [...new Set(heatmap.map((c) => c.isoDate))].sort();
                    return dates.slice(0, 62).map((iso, rowIdx) => {
                      const dayCells = heatmap.filter((c) => c.isoDate === iso);
                      const dateLabel = dayCells[0]?.dateLabel ?? iso.slice(8);
                      return (
                        <tr key={iso} style={{ background: rowIdx % 2 === 0 ? "#fff" : "#fafbfc", borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "6px 12px", color: "#475569", fontWeight: 700, fontSize: 13 }}>{dateLabel}</td>
                          {SHIFTS.map((sh) => {
                            const cell = dayCells.find((c) => c.shift === sh);
                            const s = cell?.status ?? "none";
                            return (
                              <td key={sh} title={cell ? `${cell.inspectionCount} รอบ | ผิดปกติ ${cell.abnormalCount}` : "ไม่มีข้อมูล"}
                                style={{ padding: "6px 8px", textAlign: "center" }}>
                                <div style={{
                                  borderRadius: 8, background: statusBg(s),
                                  border: `1px solid ${statusColor(s)}66`,
                                  padding: "6px 4px",
                                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2
                                }}>
                                  <span style={{ fontSize: 14, fontWeight: 800, color: statusColor(s), lineHeight: 1 }}>
                                    {s === "none" ? "—" : s === "normal" ? "✓" : s === "warning" ? "⚠" : "✗"}
                                  </span>
                                  {cell && cell.inspectionCount > 0 && (
                                    <span style={{ fontSize: 10, color: statusColor(s), opacity: 0.8 }}>
                                      {cell.inspectionCount} รอบ
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section 5 + 6: Checklist Analytics + Top Incidents ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

            {/* Checklist Analytics */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #f0fdf4" }}><span style={{ background: "#dcfce7", color: "#059669", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 800 }}>✅ Checklist Analytics</span></div>
              {checklistStats.length === 0 ? (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>ไม่มีข้อมูล</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {checklistStats.map((item) => (
                    <div key={item.itemId}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <div style={{ fontSize: 12, color: "#1e293b", fontWeight: 600 }}>{item.itemName}</div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: complianceColor(item.passPct), minWidth: 36, textAlign: "right" }}>{item.passPct}%</span>
                      </div>
                      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${item.passPct}%`, background: complianceColor(item.passPct), borderRadius: 99, transition: "width .4s" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{item.categoryName} · {item.normal}/{item.total} ปกติ</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Incidents */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #fee2e2" }}><span style={{ background: "#fee2e2", color: "#dc2626", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 800 }}>🔴 Top Incidents</span></div>
              {incidents.length === 0 ? (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: 20, fontSize: 13 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                  ไม่พบรายการผิดปกติในช่วงนี้
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {incidents.map((inc, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#fff5f5", borderRadius: 8, border: "1px solid #fee2e2" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#dc2626", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{inc.itemName}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{inc.categoryName} · ล่าสุด {inc.lastDate}</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#dc2626", whiteSpace: "nowrap" }}>{inc.count} ครั้ง</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


        </div>
      </div>
    </AppShell>
  );
}
