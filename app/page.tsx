import { AppShell } from "@/components/AppShell";
import { DiskTrendChart } from "@/components/DashboardCharts";
import { ShiftStatusChart } from "@/components/InspectionCharts";
import { prisma } from "@/lib/prisma";
import { categoryLabels } from "@/lib/constants";
import { currentBuddhistYear, daysInThaiMonth, thaiMonthLabel } from "@/lib/date";
import { diskUsagePercent } from "@/lib/report";
import { requireUser } from "@/lib/auth";
import { equipmentAge, equipmentAgeRisk, type EquipmentAgeRisk } from "@/lib/assets";
import { inspectionShiftColors, inspectionShiftFullLabels, inspectionShiftLabels, inspectionShiftOrder } from "@/lib/inspection-shifts";

const diskTrendColors = ["#2563eb", "#14b8a6", "#f97316", "#a855f7", "#ef4444", "#0f766e", "#64748b", "#ca8a04"];

function selectedMonth(searchParams?: { month?: string; buddhistYear?: string; serverId?: string | string[] }) {
  const now = new Date();
  const month = Number(searchParams?.month ?? now.getMonth() + 1);
  const buddhistYear = Number(searchParams?.buddhistYear ?? currentBuddhistYear());
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    buddhistYear: Number.isInteger(buddhistYear) && buddhistYear > 2400 ? buddhistYear : currentBuddhistYear()
  };
}

function searchParamValues(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function DashboardPage(
  props: { searchParams?: Promise<{ month?: string; buddhistYear?: string; serverId?: string | string[] }> }
) {
  const searchParams = await props.searchParams;
  await requireUser();

  const { month, buddhistYear } = selectedMonth(searchParams);
  const maxDay = daysInThaiMonth(month, buddhistYear);
  const monthStart = new Date(buddhistYear - 543, month - 1, 1);
  const monthEnd = new Date(buddhistYear - 543, month, 0);
  const selectedServerParams = searchParamValues(searchParams?.serverId);
  const showAllServers = selectedServerParams.length === 0 || selectedServerParams.includes("all");

  const [report, categories, dailyInspections] = await Promise.all([
    prisma.monthlyReport.findUnique({ where: { month_buddhistYear: { month, buddhistYear } } }),
    prisma.assetCategory.findMany({ include: { assets: true }, orderBy: { displayOrder: "asc" } }),
    prisma.dailyInspection.findMany({
      where: { inspectionDate: { gte: monthStart, lte: monthEnd } },
      include: { results: true }
    })
  ]);

  const latestMetrics = report
    ? await prisma.serverMetricLog.findMany({
      where: { reportId: report.id },
      orderBy: { measuredAt: "asc" },
      take: 120,
      include: { serverAsset: true }
    })
    : [];

  const entries = report
    ? await prisma.dailyStatusEntry.findMany({
        where: { reportId: report.id },
        include: {
          asset: { include: { category: true } },
          updatedBy: { select: { id: true, displayName: true } }
        }
      })
    : [];

  // --- Disk Trend ---
  const diskServerOptions = Array.from(
    new Map(latestMetrics.map((metric) => [metric.serverAssetId, { id: metric.serverAssetId, name: metric.serverAsset.name }])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));
  const diskServerSeriesOptions = diskServerOptions.map((server, index) => ({
    ...server, color: diskTrendColors[index % diskTrendColors.length]
  }));
  const requestedServerId = showAllServers
    ? null
    : selectedServerParams.find((id) => diskServerOptions.some((server) => server.id === id)) ?? null;
  const selectedServerIds = requestedServerId ? [requestedServerId] : diskServerOptions.map((s) => s.id);
  const selectedServerValue = requestedServerId ?? "all";
  const selectedServerName = requestedServerId
    ? diskServerOptions.find((s) => s.id === requestedServerId)?.name ?? "Server"
    : "แสดงทั้งหมด";
  const selectedMetricRows = latestMetrics.filter((m) => selectedServerIds.includes(m.serverAssetId));
  const diskTrendMap = new Map<string, { date: string } & Record<string, number | string>>();
  const latestDiskMetricByServer = new Map<string, typeof latestMetrics[number]>();
  selectedMetricRows.forEach((metric) => {
    const key = metric.measuredAt.toISOString();
    const date = metric.measuredAt.toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const row = diskTrendMap.get(key) ?? { date };
    row[metric.serverAssetId] = diskUsagePercent(Number(metric.diskUsedGb), Number(metric.diskTotalGb));
    diskTrendMap.set(key, row);
    latestDiskMetricByServer.set(metric.serverAssetId, metric);
  });
  const diskTrend = Array.from(diskTrendMap.values());
  const diskTrendSeries = diskServerSeriesOptions
    .filter((s) => selectedServerIds.includes(s.id))
    .map((s) => ({ key: s.id, name: s.name, color: s.color }));
  const selectedDiskServerSummary = requestedServerId ? (() => {
    const metric = latestDiskMetricByServer.get(requestedServerId);
    const s = diskServerSeriesOptions.find((x) => x.id === requestedServerId);
    if (!s) return null;
    return {
      name: s.name, color: s.color, measuredAt: metric?.measuredAt,
      cpuPercent: metric ? Number(metric.cpuPercent) : null,
      ramUsedGb: metric ? Number(metric.ramUsedGb) : null,
      ramTotalGb: metric ? Number(metric.ramTotalGb) : null,
      ramPercent: metric ? diskUsagePercent(Number(metric.ramUsedGb), Number(metric.ramTotalGb)) : null,
      diskUsedGb: metric ? Number(metric.diskUsedGb) : null,
      diskTotalGb: metric ? Number(metric.diskTotalGb) : null,
      diskPercent: metric ? diskUsagePercent(Number(metric.diskUsedGb), Number(metric.diskTotalGb)) : null
    };
  })() : null;

  // --- Inspection ---
  const inspectionResultCount = dailyInspections.reduce((sum, i) => sum + i.results.length, 0);
  const inspectionAbnormalCount = dailyInspections.reduce(
    (sum, i) => sum + i.results.filter((r) => r.status === "ABNORMAL").length, 0
  );
  const shiftStatusData = inspectionShiftOrder.map((shift) => {
    const si = dailyInspections.filter((i) => i.inspectionShift === shift);
    const sr = si.flatMap((i) => i.results);
    return { shift, label: inspectionShiftLabels[shift], inspections: si.length, normal: sr.filter((r) => r.status === "NORMAL").length, abnormal: sr.filter((r) => r.status === "ABNORMAL").length };
  });

  // === Daily Shared Recording Model ===
  const today = new Date();
  const todayDay = (today.getFullYear() + 543 === buddhistYear && today.getMonth() + 1 === month) ? today.getDate() : 0;
  const todayDateStr = today.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });

  const todayEntries = todayDay > 0 ? entries.filter((e) => e.day === todayDay) : [];
  const todayAssetIds = new Set(todayEntries.map((e) => e.assetId));
  const todayCoverage = todayAssetIds.size;
  const totalAssets = categories.reduce((sum, c) => sum + c.assets.filter((a) => a.active).length, 0);
  const todayCoveragePct = totalAssets > 0 ? Math.round((todayCoverage / totalAssets) * 100) : 0;
  const todayWarning = todayEntries.filter((e) => e.statusCode === "H").length;
  const todayCritical = todayEntries.filter((e) => e.statusCode === "F").length;

  const categoryIcons: Record<string, string> = { VM: "🖥️", SERVER: "🗄️", NETWORK: "🌐", BACKUP: "💾" };
  const categoryColors: Record<string, string> = { VM: "#2563eb", SERVER: "#7c3aed", NETWORK: "#0891b2", BACKUP: "#059669" };

  const categoryStats = categories.map((category) => {
    const activeAssets = category.assets.filter((a) => a.active).length;
    const catToday = todayEntries.filter((e) => e.asset.categoryId === category.id);
    const catTodayCoverage = new Set(catToday.map((e) => e.assetId)).size;
    const catTodayPct = activeAssets > 0 ? Math.round((catTodayCoverage / activeAssets) * 100) : 0;
    const catNormal = catToday.filter((e) => e.statusCode === "N").length;
    const catWarning = catToday.filter((e) => e.statusCode === "H").length;
    const catCritical = catToday.filter((e) => e.statusCode === "F").length;
    const catDaysRecorded = new Set(entries.filter((e) => e.asset.categoryId === category.id).map((e) => e.day)).size;
    return { code: category.code, name: categoryLabels[category.code], activeAssets, todayCoverage: catTodayCoverage, todayPct: catTodayPct, normal: catNormal, warning: catWarning, critical: catCritical, daysRecorded: catDaysRecorded };
  });

  const riskBucketConfig: Record<Exclude<EquipmentAgeRisk, "unknown">, { label: string; tone: string }> = {
    low: { label: "ต่ำ 1-5 ปี", tone: "low" },
    medium: { label: "กลาง 6-9 ปี", tone: "medium" },
    high: { label: "สูง 10-15 ปี", tone: "high" }
  };

  const assetRiskCategories = categories
    .filter((category) => category.code === "SERVER" || category.code === "NETWORK")
    .map((category) => {
      const activeAssets = category.assets.filter((asset) => asset.active);
      const assetsWithRisk = activeAssets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        installedAt: asset.installedAt,
        age: equipmentAge(asset.installedAt, today),
        risk: equipmentAgeRisk(asset.installedAt, today)
      }));
      const counts: Record<EquipmentAgeRisk, number> = { low: 0, medium: 0, high: 0, unknown: 0 };
      assetsWithRisk.forEach((asset) => {
        counts[asset.risk] += 1;
      });
      const oldestAssets = assetsWithRisk
        .filter((asset) => asset.installedAt)
        .sort((a, b) => Number(a.installedAt) - Number(b.installedAt))
        .slice(0, 4);
      const highPercent = activeAssets.length > 0 ? Math.round((counts.high / activeAssets.length) * 100) : 0;

      return {
        code: category.code,
        name: category.code === "SERVER" ? "Host Server" : "Network Device",
        total: activeAssets.length,
        counts,
        highPercent,
        oldestAssets
      };
    });

  // Shared Recording contributors
  const recorderMap = new Map<string, { name: string; count: number }>();
  todayEntries.forEach((e) => {
    const uid = e.updatedById ?? "unknown";
    const name = e.updatedBy?.displayName ?? "ไม่ทราบ";
    const ex = recorderMap.get(uid);
    if (ex) { ex.count++; } else { recorderMap.set(uid, { name, count: 1 }); }
  });
  const recorders = Array.from(recorderMap.values()).sort((a, b) => b.count - a.count);

  // Shift summary (today) — workload
  const SHIFT_SLOTS: Record<string, { label: string; slots: string[] }> = {
    MORNING: { label: "เวรเช้า", slots: ["SLOT_0800_0900", "SLOT_0900_1000", "SLOT_1100_1200", "SLOT_1300_1400", "SLOT_1400_1500", "SLOT_1500_1600"] },
    AFTERNOON: { label: "เวรบ่าย", slots: ["SLOT_1600_1700", "SLOT_1700_1800", "SLOT_1800_1900", "SLOT_1900_2000", "SLOT_2000_2100", "SLOT_2100_2200", "SLOT_2200_2300", "SLOT_2300_2400"] },
    NIGHT: { label: "เวรดึก", slots: ["SLOT_0000_0100", "SLOT_0100_0200", "SLOT_0200_0300", "SLOT_0300_0400", "SLOT_0400_0500", "SLOT_0500_0600", "SLOT_0600_0700", "SLOT_0700_0800"] }
  };
  const shiftSummary = Object.entries(SHIFT_SLOTS).map(([key, shift]) => {
    const se = todayEntries.filter((e) => shift.slots.includes(e.timeSlot));
    return { key, label: shift.label, entries: se.length, recorders: new Set(se.map((e) => e.updatedById).filter(Boolean)).size };
  });

  // Top Issues
  const topIssues = todayEntries
    .filter((e) => e.statusCode === "H" || e.statusCode === "F")
    .map((e) => ({ assetName: e.asset.name, statusCode: e.statusCode, note: e.note ?? "" }));

  // Monthly Overview
  const daysRecorded = new Set(entries.map((e) => e.day)).size;
  const monthlyPct = maxDay > 0 ? Math.round((daysRecorded / maxDay) * 100) : 0;

  // Server Metrics Summary (from new ServerMetricEntry)
  const todayStart = new Date();todayStart.setHours(0, 0, 0, 0);
  const todayMetrics = await prisma.serverMetricEntry.findMany({
    where: { recordDate: todayStart },
    include: { asset: { include: { category: true } }, disks: true }
  });

  const vmMetrics = todayMetrics.filter((m) => m.asset.category.code === "VM");
  const serverMetrics = todayMetrics.filter((m) => m.asset.category.code === "SERVER");
  const allTodayMetrics = [...vmMetrics, ...serverMetrics];
  const metricAssetCount = allTodayMetrics.length;
  const totalVmServer = categories
    .filter((c) => c.code === "VM" || c.code === "SERVER")
    .reduce((sum, c) => sum + c.assets.filter((a) => a.active).length, 0);
  const metricCoveragePct = totalVmServer > 0 ? Math.round((metricAssetCount / totalVmServer) * 100) : 0;

  const avgCpu = metricAssetCount > 0 ? Math.round(allTodayMetrics.reduce((s, m) => s + Number(m.cpuPercent), 0) / metricAssetCount) : 0;
  const avgRam = metricAssetCount > 0 ? Math.round(allTodayMetrics.reduce((s, m) => s + Number(m.ramPercent), 0) / metricAssetCount) : 0;
  const avgDisk = metricAssetCount > 0 ? (() => {
    const allDisks = allTodayMetrics.flatMap((m) => m.disks);
    return allDisks.length > 0 ? Math.round(allDisks.reduce((s, d) => s + Number(d.percent), 0) / allDisks.length) : 0;
  })() : 0;

  const metricWarnings = allTodayMetrics.filter((m) => m.overallStatus === "WARNING").length;
  const metricCriticals = allTodayMetrics.filter((m) => m.overallStatus === "CRITICAL").length;

  // Top Resource Usage
  const topDisk = allTodayMetrics
    .flatMap((m) => m.disks.map((d) => ({ assetName: m.asset.name, diskName: d.diskName, percent: Number(d.percent), status: d.status })))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);
  const topRam = allTodayMetrics
    .map((m) => ({ assetName: m.asset.name, percent: Number(m.ramPercent), status: m.ramStatus }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);
  const topCpu = allTodayMetrics
    .map((m) => ({ assetName: m.asset.name, percent: Number(m.cpuPercent), status: m.cpuStatus }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);

  return (
    <AppShell title="Dashboard" subtitle="Data Center Operations">
      {/* Header */}
      <section style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>📊 Data Center Operations</h2>
        <form className="form-row" method="get" style={{ margin: 0, background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 14px", gap: 8, alignItems: "center" }}>
          <select name="month" defaultValue={month} style={{ fontSize: 14, padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}>
            {Array.from({ length: 12 }, (_, i) => (<option key={i + 1} value={i + 1}>{i + 1}</option>))}
          </select>
          <span style={{ color: "#6b7280", fontSize: 13 }}>/</span>
          <input name="buddhistYear" type="number" defaultValue={buddhistYear} style={{ width: 72, fontSize: 14, padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db" }} />
          <button className="button" type="submit" style={{ fontSize: 13, padding: "5px 14px" }}>แสดง</button>
        </form>
      </section>

      {/* Executive Summary */}
      <section className="card" style={{ marginBottom: 20, background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)", color: "#fff", borderRadius: 14, padding: "24px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>วันที่</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{todayDateStr}</div>
          </div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Coverage วันนี้</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{todayCoverage} / {totalAssets} Asset</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: todayCoveragePct >= 100 ? "#4ade80" : "#fbbf24" }}>{todayCoveragePct}%</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, opacity: 0.7, color: "#fbbf24" }}>Warning</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fbbf24" }}>{todayWarning}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, opacity: 0.7, color: "#fca5a5" }}>Critical</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: todayCritical > 0 ? "#f87171" : "#4ade80" }}>{todayCritical}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Coverage per category */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 14px 0", fontSize: 16, fontWeight: 700 }}>📋 Daily Coverage</h2>
        <div className="grid grid-4" style={{ gap: 14 }}>
          {categoryStats.map((cat) => (
            <div key={cat.code} style={{ border: "1px solid var(--line)", borderTop: `4px solid ${categoryColors[cat.code] ?? "#6b7280"}`, borderRadius: 10, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{categoryIcons[cat.code] ?? "📦"}</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{cat.name}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: cat.todayPct >= 100 ? "#059669" : cat.todayPct > 0 ? "#f59e0b" : "#9ca3af" }}>
                {cat.todayCoverage} / {cat.activeAssets}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{cat.todayPct}%</div>
            </div>
          ))}
        </div>
      </section>

      {/* Equipment Age Risk */}
      <section className="card equipment-risk-dashboard" style={{ marginBottom: 20 }}>
        <div className="section-heading" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>ความเสี่ยงอายุการใช้งานอุปกรณ์</h2>
            <p className="muted">ประเมินจากวันที่ติดตั้งของ Host Server และ Network Device</p>
          </div>
          <div className="risk-legend" aria-label="เกณฑ์ความเสี่ยงอายุอุปกรณ์">
            {Object.entries(riskBucketConfig).map(([key, item]) => (
              <span key={key} className={`risk-legend-item ${item.tone}`}>{item.label}</span>
            ))}
          </div>
        </div>

        <div className="equipment-risk-grid">
          {assetRiskCategories.map((category) => (
            <article key={category.code} className="equipment-risk-card">
              <div className="equipment-risk-card-head">
                <div>
                  <span className="equipment-risk-eyebrow">{category.name}</span>
                  <h3>{category.total} อุปกรณ์ Active</h3>
                </div>
                <span className={`equipment-risk-score ${category.counts.high > 0 ? "high" : category.counts.medium > 0 ? "medium" : "low"}`}>
                  เสี่ยงสูง {category.highPercent}%
                </span>
              </div>

              <div className="equipment-risk-bars">
                {Object.entries(riskBucketConfig).map(([risk, item]) => {
                  const count = category.counts[risk as Exclude<EquipmentAgeRisk, "unknown">];
                  const percent = category.total > 0 ? Math.round((count / category.total) * 100) : 0;
                  return (
                    <div key={risk} className="equipment-risk-row">
                      <div className="equipment-risk-row-label">
                        <span>{item.label}</span>
                        <strong>{count}</strong>
                      </div>
                      <div className="equipment-risk-track">
                        <span className={`equipment-risk-fill ${item.tone}`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="equipment-risk-summary">
                <span>ไม่ระบุวันที่ติดตั้ง <strong>{category.counts.unknown}</strong></span>
                <span>รวม <strong>{category.total}</strong></span>
              </div>

              {category.oldestAssets.length > 0 ? (
                <div className="equipment-risk-oldest">
                  <div className="equipment-risk-oldest-title">อุปกรณ์อายุสูงสุด</div>
                  {category.oldestAssets.map((asset) => (
                    <div key={asset.id} className="equipment-risk-oldest-item">
                      <span>{asset.name}</span>
                      <strong>{asset.age}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="equipment-risk-empty">ยังไม่มีข้อมูลวันที่ติดตั้ง</div>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Shared Recording Summary */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 14px 0", fontSize: 16, fontWeight: 700 }}>👥 Shared Recording — วันนี้</h2>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: 16, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>ผู้บันทึก</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#2563eb" }}>{recorders.length} <span style={{ fontSize: 14, fontWeight: 500 }}>คน</span></div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            {recorders.length === 0 ? (
              <div className="muted" style={{ padding: 16 }}>ยังไม่มีการบันทึกวันนี้</div>
            ) : (
              <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
                <tbody>
                  {recorders.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#6b7280" }}>{r.count} รายการ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* Shift Summary — workload */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 14px 0", fontSize: 16, fontWeight: 700 }}>⏰ Shift Summary — วันนี้</h2>
        <div className="grid grid-3" style={{ gap: 14 }}>
          {shiftSummary.map((shift) => {
            const clr = shift.key === "MORNING" ? "#2563eb" : shift.key === "AFTERNOON" ? "#f97316" : "#6366f1";
            return (
              <div key={shift.key} style={{ border: "1px solid var(--line)", borderTop: `4px solid ${clr}`, borderRadius: 10, padding: 16, background: "#fff" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: clr }}>{shift.label}</div>
                <div style={{ fontSize: 13, color: "#374151" }}>บันทึก <strong>{shift.entries}</strong> รายการ</div>
                <div style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>ผู้บันทึก <strong>{shift.recorders}</strong> คน</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* System Health per category */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 14px 0", fontSize: 16, fontWeight: 700 }}>🏥 System Health — วันนี้</h2>
        <div className="grid grid-4" style={{ gap: 14 }}>
          {categoryStats.map((cat) => (
            <div key={cat.code} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 16, background: "#fff" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{categoryIcons[cat.code]} {cat.name}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Normal</span><strong style={{ color: "#059669" }}>{cat.normal}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Warning</span><strong style={{ color: "#f59e0b" }}>{cat.warning}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Critical</span><strong style={{ color: "#dc2626" }}>{cat.critical}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top Issues */}
      {topIssues.length > 0 && (
        <section className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 14px 0", fontSize: 16, fontWeight: 700 }}>🚨 Top Issues — วันนี้</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topIssues.slice(0, 10).map((issue, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: issue.statusCode === "F" ? "#fef2f2" : "#fffbeb", border: `1px solid ${issue.statusCode === "F" ? "#fecaca" : "#fde68a"}`, borderRadius: 8 }}>
                <span style={{ fontSize: 18 }}>{issue.statusCode === "F" ? "🔴" : "⚠️"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{issue.assetName}</div>
                  {issue.note && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{issue.note}</div>}
                </div>
                <span className={`badge ${issue.statusCode === "F" ? "locked" : ""}`}>
                  {issue.statusCode === "F" ? "Critical" : "Warning"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Monthly Overview */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 14px 0", fontSize: 16, fontWeight: 700 }}>📅 Monthly Overview — {thaiMonthLabel(month, buddhistYear)}</h2>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 16, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>วันที่มีการบันทึก</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#059669" }}>{daysRecorded} / {maxDay} <span style={{ fontSize: 14, fontWeight: 500 }}>วัน</span></div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{monthlyPct}%</div>
          </div>
        </div>
        <div className="grid grid-4" style={{ gap: 10 }}>
          {categoryStats.map((cat) => (
            <div key={cat.code} style={{ fontSize: 13, padding: "8px 12px", background: "#f9fafb", borderRadius: 8, border: "1px solid #f3f4f6" }}>
              <span style={{ fontWeight: 600 }}>{cat.name}</span>
              <span style={{ float: "right", color: "#059669" }}>ครบ {cat.daysRecorded} วัน</span>
            </div>
          ))}
        </div>
      </section>

      {/* Server Metrics Summary */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="section-heading" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🖥️ Server Metrics Summary — วันนี้</h2>
            <p className="muted">สรุป CPU / RAM / Disk ของ VM Host + Host Server</p>
          </div>
          <a href="/servers/metrics" className="badge" style={{ textDecoration: "none" }}>บันทึก Metrics →</a>
        </div>

        <div className="grid grid-4" style={{ gap: 12, marginBottom: 16 }}>
          <div style={{ border: "1px solid var(--line)", borderTop: "4px solid #2563eb", borderRadius: 10, padding: 14, background: "#fff" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Coverage</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: metricCoveragePct >= 100 ? "#059669" : "#2563eb" }}>{metricAssetCount} / {totalVmServer}</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>{metricCoveragePct}%</div>
          </div>
          <div style={{ border: "1px solid var(--line)", borderTop: "4px solid #7c3aed", borderRadius: 10, padding: 14, background: "#fff" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Avg CPU</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: avgCpu >= 90 ? "#dc2626" : avgCpu >= 80 ? "#f59e0b" : "#059669" }}>{avgCpu}%</div>
          </div>
          <div style={{ border: "1px solid var(--line)", borderTop: "4px solid #0891b2", borderRadius: 10, padding: 14, background: "#fff" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Avg RAM</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: avgRam >= 90 ? "#dc2626" : avgRam >= 80 ? "#f59e0b" : "#059669" }}>{avgRam}%</div>
          </div>
          <div style={{ border: "1px solid var(--line)", borderTop: "4px solid #059669", borderRadius: 10, padding: 14, background: "#fff" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Avg Disk</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: avgDisk >= 90 ? "#dc2626" : avgDisk >= 80 ? "#f59e0b" : "#059669" }}>{avgDisk}%</div>
          </div>
        </div>

        {(metricWarnings > 0 || metricCriticals > 0) && (
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {metricWarnings > 0 && <span style={{ fontWeight: 700, fontSize: 13, color: "#f59e0b", background: "#fffbeb", padding: "4px 12px", borderRadius: 8, border: "1px solid #fde68a" }}>⚠️ Warning: {metricWarnings} เครื่อง</span>}
            {metricCriticals > 0 && <span style={{ fontWeight: 700, fontSize: 13, color: "#dc2626", background: "#fef2f2", padding: "4px 12px", borderRadius: 8, border: "1px solid #fecaca" }}>🔴 Critical: {metricCriticals} เครื่อง</span>}
          </div>
        )}

        {/* Top Resource Usage */}
        {(topDisk.length > 0 || topRam.length > 0 || topCpu.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {topDisk.length > 0 && (
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: 14, border: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>💾 Top Disk Usage</div>
                {topDisk.map((d, i) => {
                  const color = d.status === "CRITICAL" ? "#dc2626" : d.status === "WARNING" ? "#f59e0b" : "#059669";
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "3px 0", borderBottom: i < topDisk.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <span>{d.assetName}{d.diskName !== "Main" ? ` (${d.diskName})` : ""}</span>
                      <span style={{ fontWeight: 700, color }}>{d.percent}%</span>
                    </div>
                  );
                })}
              </div>
            )}
            {topRam.length > 0 && (
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: 14, border: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>🧠 Top RAM Usage</div>
                {topRam.map((r, i) => {
                  const color = r.status === "CRITICAL" ? "#dc2626" : r.status === "WARNING" ? "#f59e0b" : "#059669";
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "3px 0", borderBottom: i < topRam.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <span>{r.assetName}</span>
                      <span style={{ fontWeight: 700, color }}>{r.percent}%</span>
                    </div>
                  );
                })}
              </div>
            )}
            {topCpu.length > 0 && (
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: 14, border: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>⚡ Top CPU Usage</div>
                {topCpu.map((c, i) => {
                  const color = c.status === "CRITICAL" ? "#dc2626" : c.status === "WARNING" ? "#f59e0b" : "#059669";
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "3px 0", borderBottom: i < topCpu.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <span>{c.assetName}</span>
                      <span style={{ fontWeight: 700, color }}>{c.percent}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Inspection Summary */}
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="section-heading asset-list-heading">
          <div>
            <h2>🏢 ภาพรวมตรวจสอบห้อง Data Center</h2>
            <p className="muted">สรุปผลตรวจรายวันตามเวรของเดือน {thaiMonthLabel(month, buddhistYear)}</p>
          </div>
          <span className={`badge ${inspectionAbnormalCount > 0 ? "locked" : ""}`}>
            {dailyInspections.length} ครั้ง / ผิดปกติ {inspectionAbnormalCount}
          </span>
        </div>
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          {shiftStatusData.map((shift) => (
            <div key={shift.shift} className="stat" style={{ border: "1px solid var(--line)", borderTop: `4px solid ${inspectionShiftColors[shift.shift]}`, borderRadius: 10, padding: 14, background: "#fff" }}>
              <span className="muted">{inspectionShiftFullLabels[shift.shift]}</span>
              <span className="stat-value">{shift.inspections}</span>
              <span className="muted">ครั้งที่บันทึกในเดือนนี้</span>
              <span>
                <span className="badge">ปกติ {shift.normal}</span>{" "}
                <span className={`badge ${shift.abnormal > 0 ? "locked" : ""}`}>ผิดปกติ {shift.abnormal}</span>
              </span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginBottom: 10 }}>รายการตรวจทั้งหมด {inspectionResultCount} รายการ</p>
        <ShiftStatusChart data={shiftStatusData} height={280} />
      </section>

      {/* Disk Trend */}
      <section className="card">
        <div className="section-heading asset-list-heading">
          <div>
            <h2>แนวโน้มการใช้ Disk</h2>
            <p className="muted">แยกตาม server จากข้อมูล metrics ของเดือนที่เลือก</p>
          </div>
          <form className="form-row" method="get" style={{ margin: 0 }}>
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="buddhistYear" value={buddhistYear} />
            <label style={{ minWidth: 240 }}>
              Server
              <select name="serverId" defaultValue={selectedServerValue}>
                <option value="all">แสดงทั้งหมด</option>
                {diskServerOptions.map((server) => (<option key={server.id} value={server.id}>{server.name}</option>))}
              </select>
            </label>
            <button className="button secondary" type="submit" disabled={diskServerOptions.length === 0}>แสดงข้อมูล</button>
          </form>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <span className="badge">{selectedServerName}</span>
          <span className="muted" style={{ fontSize: 13 }}>{requestedServerId ? "แสดงเฉพาะ server ที่เลือก" : "แสดงภาพรวมทุก server"}</span>
        </div>
        {selectedDiskServerSummary ? (
          <div style={{ marginBottom: 18 }}>
            <div style={{ border: "1px solid var(--line)", borderTop: `4px solid ${selectedDiskServerSummary.color}`, borderRadius: 8, padding: 16, background: "#ffffff", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, alignItems: "center" }}>
              <div>
                <strong style={{ display: "block", fontSize: 18 }}>{selectedDiskServerSummary.name}</strong>
                <span className="muted" style={{ fontSize: 12 }}>ล่าสุด {selectedDiskServerSummary.measuredAt ? selectedDiskServerSummary.measuredAt.toLocaleString("th-TH") : "-"}</span>
              </div>
              <div><div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>CPU</div><strong>{selectedDiskServerSummary.cpuPercent === null ? "-" : `${selectedDiskServerSummary.cpuPercent}%`}</strong></div>
              <div><div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>RAM</div><strong>{selectedDiskServerSummary.ramUsedGb ?? "-"} / {selectedDiskServerSummary.ramTotalGb ?? "-"} GB</strong></div>
              <div><div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Disk</div><strong>{selectedDiskServerSummary.diskUsedGb ?? "-"} / {selectedDiskServerSummary.diskTotalGb ?? "-"} GB</strong>{" "}<span className={`badge ${(selectedDiskServerSummary.diskPercent ?? 0) >= 85 ? "locked" : ""}`}>{selectedDiskServerSummary.diskPercent === null ? "-" : `${selectedDiskServerSummary.diskPercent}%`}</span></div>
            </div>
          </div>
        ) : null}
        {diskTrend.length > 0 ? (
          <DiskTrendChart data={diskTrend} series={diskTrendSeries} />
        ) : (
          <div className="muted" style={{ border: "1px dashed var(--line)", borderRadius: 8, padding: "4rem 1rem", textAlign: "center" }}>ยังไม่มีข้อมูล server metrics สำหรับเดือนที่เลือก</div>
        )}
      </section>
    </AppShell>
  );
}
