import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categoryLabels } from "@/lib/constants";
import { currentBuddhistYear, thaiMonthLabel } from "@/lib/date";
import { parseAssetCapacityGb } from "@/lib/assets";
import { FastEntryForm } from "./FastEntryForm";

const serverTypeMap = { vm: "VM", host: "SERVER" } as const;
type ServerType = keyof typeof serverTypeMap;

function todayDateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default async function MetricsRecordingPage(
  props: { searchParams: Promise<{ type?: string; date?: string; error?: string; saved?: string }> }
) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const selectedType: ServerType = searchParams.type === "host" ? "host" : "vm";
  const categoryCode = serverTypeMap[selectedType];
  const recordDate = searchParams.date || todayDateStr();
  const returnTo = `/servers/metrics?type=${selectedType}&date=${recordDate}`;

  const buddhistYear = currentBuddhistYear();
  const now = new Date();
  const month = now.getMonth() + 1;

  const assets = await prisma.asset.findMany({
    where: { active: true, category: { code: categoryCode } },
    orderBy: { displayOrder: "asc" }
  });

  // Get previous metrics for each asset (most recent ServerMetricEntry)
  const prevEntries = await prisma.serverMetricEntry.findMany({
    where: { assetId: { in: assets.map((a) => a.id) } },
    orderBy: { recordDate: "desc" },
    distinct: ["assetId"],
    include: { disks: true }
  });

  const lastMetrics: Record<string, { cpuPercent: number; ramUsedGb: number; diskUsedGb: number; diskTotalGb: number }> = {};
  prevEntries.forEach((entry) => {
    const mainDisk = entry.disks.find((d) => d.diskName === "Main");
    lastMetrics[entry.assetId] = {
      cpuPercent: Number(entry.cpuPercent),
      ramUsedGb: Number(entry.ramUsedGb),
      diskUsedGb: mainDisk ? Number(mainDisk.usedGb) : 0,
      diskTotalGb: mainDisk ? Number(mainDisk.totalGb) : Number(entry.ramTotalGb)
    };
  });

  // Also try legacy ServerMetricLog for assets without new entries
  const assetsWithoutNew = assets.filter((a) => !lastMetrics[a.id]);
  if (assetsWithoutNew.length > 0) {
    const legacyMetrics = await prisma.serverMetricLog.findMany({
      where: { serverAssetId: { in: assetsWithoutNew.map((a) => a.id) } },
      orderBy: { measuredAt: "desc" },
      distinct: ["serverAssetId"]
    });
    legacyMetrics.forEach((m) => {
      if (!lastMetrics[m.serverAssetId]) {
        lastMetrics[m.serverAssetId] = {
          cpuPercent: Number(m.cpuPercent),
          ramUsedGb: Number(m.ramUsedGb),
          diskUsedGb: Number(m.diskUsedGb),
          diskTotalGb: Number(m.diskTotalGb)
        };
      }
    });
  }

  // Today's recording summary
  const todayRecordDate = new Date(recordDate);
  todayRecordDate.setHours(0, 0, 0, 0);
  const todayEntries = await prisma.serverMetricEntry.findMany({
    where: {
      recordDate: todayRecordDate,
      asset: { category: { code: categoryCode } }
    },
    include: {
      asset: { select: { name: true } },
      updatedBy: { select: { displayName: true } }
    }
  });

  const recordedAssetIds = new Set(todayEntries.map((e) => e.assetId));
  const totalActive = assets.length;
  const recordedCount = recordedAssetIds.size;
  const coveragePct = totalActive > 0 ? Math.round((recordedCount / totalActive) * 100) : 0;

  const recorderMap = new Map<string, { name: string; count: number }>();
  todayEntries.forEach((e) => {
    const uid = e.updatedById ?? "unknown";
    const name = e.updatedBy?.displayName ?? "ไม่ทราบ";
    const ex = recorderMap.get(uid);
    if (ex) { ex.count++; } else { recorderMap.set(uid, { name, count: 1 }); }
  });
  const recorders = Array.from(recorderMap.values()).sort((a, b) => b.count - a.count);

  const warningCount = todayEntries.filter((e) => e.overallStatus === "WARNING").length;
  const criticalCount = todayEntries.filter((e) => e.overallStatus === "CRITICAL").length;

  const assetRows = assets.map((a) => ({
    id: a.id,
    name: a.name,
    cpu: a.cpu,
    ram: a.ram,
    disk: a.disk,
    os: a.os,
    ramTotalGb: parseAssetCapacityGb(a.ram),
    diskTotalGb: parseAssetCapacityGb(a.disk)
  }));

  const displayDate = new Date(recordDate).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <AppShell title="Server Metrics" subtitle="บันทึก CPU / RAM / Disk — Daily Shared Recording">
      {/* Header: Type & Date selector */}
      <section style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📊 Server Metrics — {categoryLabels[categoryCode]}</h2>
        <form method="get" className="form-row" style={{ margin: 0, background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 14px", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 13 }}>
            ประเภท
            <select name="type" defaultValue={selectedType} style={{ marginLeft: 4, fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}>
              <option value="vm">VM Host</option>
              <option value="host">Host Server</option>
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            วันที่
            <input name="date" type="date" defaultValue={recordDate} style={{ marginLeft: 4, fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db" }} />
          </label>
          <button className="button" type="submit" style={{ fontSize: 13, padding: "5px 14px" }}>แสดง</button>
        </form>
      </section>

      {/* Success / Error messages */}
      {searchParams.saved === "1" && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 16px", marginBottom: 14, fontSize: 13, color: "#059669", fontWeight: 600 }}>
          ✅ บันทึกสำเร็จ
        </div>
      )}
      {searchParams.error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 16px", marginBottom: 14, fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
          ❌ เกิดข้อผิดพลาด: {searchParams.error}
        </div>
      )}

      {/* Coverage Summary */}
      <div className="grid grid-4" style={{ marginBottom: 16, gap: 12 }}>
        <div className="card" style={{ padding: "14px 16px", borderTop: "4px solid #2563eb" }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Coverage {displayDate}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: coveragePct >= 100 ? "#059669" : "#2563eb" }}>
            {recordedCount} / {totalActive}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>{coveragePct}%</div>
        </div>
        <div className="card" style={{ padding: "14px 16px", borderTop: "4px solid #7c3aed" }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>ผู้บันทึก</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#7c3aed" }}>{recorders.length} <span style={{ fontSize: 13, fontWeight: 400 }}>คน</span></div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{recorders.map((r) => r.name).join(", ") || "-"}</div>
        </div>
        <div className="card" style={{ padding: "14px 16px", borderTop: "4px solid #f59e0b" }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Warning</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>{warningCount}</div>
        </div>
        <div className="card" style={{ padding: "14px 16px", borderTop: "4px solid #dc2626" }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Critical</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: criticalCount > 0 ? "#dc2626" : "#059669" }}>{criticalCount}</div>
        </div>
      </div>

      {/* Fast Entry Form */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="section-heading" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0 }}>⚡ Fast Entry — {categoryLabels[categoryCode]}</h2>
            <p className="muted">กรอก CPU%, RAM Used, Disk Used แล้วกดบันทึกทั้งหมด • ข้อมูลซ้ำจะถูกอัปเดตอัตโนมัติ</p>
          </div>
          <span className="badge">{displayDate}</span>
        </div>

        <FastEntryForm
          key={`${selectedType}-${recordDate}`}
          assets={assetRows}
          lastMetrics={lastMetrics}
          recordDate={recordDate}
          returnTo={returnTo}
          categoryCode={categoryCode}
        />
      </section>

      {/* Today's recorded entries */}
      {todayEntries.length > 0 && (
        <section className="card">
          <h2 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 700 }}>📋 รายการที่บันทึกแล้ว — {displayDate}</h2>
          <div className="table-wrap">
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>CPU %</th>
                  <th>RAM</th>
                  <th>RAM %</th>
                  <th>Status</th>
                  <th>ผู้บันทึก</th>
                </tr>
              </thead>
              <tbody>
                {todayEntries.map((e) => {
                  const stColor = e.overallStatus === "CRITICAL" ? "#dc2626" : e.overallStatus === "WARNING" ? "#f59e0b" : "#059669";
                  return (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600 }}>{e.asset.name}</td>
                      <td>{Number(e.cpuPercent)}%</td>
                      <td>{Number(e.ramUsedGb)} / {Number(e.ramTotalGb)} GB</td>
                      <td>{Number(e.ramPercent)}%</td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 11, color: stColor, background: `${stColor}15`, padding: "2px 8px", borderRadius: 6 }}>
                          {e.overallStatus}
                        </span>
                      </td>
                      <td style={{ color: "#6b7280" }}>{e.updatedBy?.displayName ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
