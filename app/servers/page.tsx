import { AppShell } from "@/components/AppShell";
import { DiskTrendChart } from "@/components/DashboardCharts";
import { ensureReportAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentBuddhistYear, thaiMonthLabel } from "@/lib/date";
import { diskUsagePercent } from "@/lib/report";
import { categoryLabels } from "@/lib/constants";
import { ServerTypeFilter } from "@/app/servers/ServerTypeFilter";
import { ServerMetricForm } from "@/app/servers/ServerMetricForm";
import { MetricHistoryActions } from "@/app/servers/MetricHistoryActions";
import { parseAssetCapacityGb } from "@/lib/assets";

const serverTypeMap = {
  vm: "VM",
  host: "SERVER"
} as const;

const serverMetricColors = ["#2563eb", "#14b8a6", "#f97316", "#8b5cf6", "#ef4444", "#0f766e", "#64748b", "#ca8a04"];

type ServerType = keyof typeof serverTypeMap;

function dateTimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default async function ServersPage(props: { searchParams: Promise<{ error?: string; type?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const now = new Date();
  const month = now.getMonth() + 1;
  const buddhistYear = currentBuddhistYear();
  const selectedType: ServerType = searchParams.type === "host" ? "host" : "vm";
  const categoryCode = serverTypeMap[selectedType];
  const returnTo = `/servers?type=${selectedType}`;
  const canManageMetrics = user.role === "ADMIN";

  const [report, servers, metrics] = await Promise.all([
    prisma.monthlyReport.findUnique({ where: { month_buddhistYear: { month, buddhistYear } } }),
    prisma.asset.findMany({
      where: { active: true, category: { code: categoryCode } },
      orderBy: { displayOrder: "asc" }
    }),
    prisma.serverMetricLog.findMany({
      where: { serverAsset: { category: { code: categoryCode } } },
      orderBy: { measuredAt: "desc" },
      take: 80,
      include: { serverAsset: true }
    })
  ]);

  const serverOptions = servers.map((server) => ({
    id: server.id,
    name: server.name,
    ram: server.ram,
    disk: server.disk,
    ramTotalGb: parseAssetCapacityGb(server.ram),
    diskTotalGb: parseAssetCapacityGb(server.disk)
  }));
  const historyServerOptions = Array.from(
    new Map(
      [...serverOptions, ...metrics.map((metric) => ({
        id: metric.serverAsset.id,
        name: metric.serverAsset.active ? metric.serverAsset.name : metric.serverAsset.name + " (inactive)",
        ram: metric.serverAsset.ram,
        disk: metric.serverAsset.disk,
        ramTotalGb: parseAssetCapacityGb(metric.serverAsset.ram),
        diskTotalGb: parseAssetCapacityGb(metric.serverAsset.disk)
      }))].map((server) => [server.id, server])
    ).values()
  );

  const latestMetricByServer = new Map<string, typeof metrics[number]>();
  metrics.forEach((metric) => {
    if (!latestMetricByServer.has(metric.serverAssetId)) {
      latestMetricByServer.set(metric.serverAssetId, metric);
    }
  });

  const metricServerOptions = historyServerOptions.filter((server) => latestMetricByServer.has(server.id));
  const perServerSummaries = metricServerOptions.map((server, index) => {
    const metric = latestMetricByServer.get(server.id);
    return {
      id: server.id,
      name: server.name,
      color: serverMetricColors[index % serverMetricColors.length],
      measuredAt: metric?.measuredAt,
      cpuPercent: metric ? Number(metric.cpuPercent) : null,
      ramUsedGb: metric ? Number(metric.ramUsedGb) : null,
      ramTotalGb: metric ? Number(metric.ramTotalGb) : null,
      diskUsedGb: metric ? Number(metric.diskUsedGb) : null,
      diskTotalGb: metric ? Number(metric.diskTotalGb) : null,
      diskPercent: metric ? diskUsagePercent(Number(metric.diskUsedGb), Number(metric.diskTotalGb)) : null
    };
  });

  const trendMap = new Map<string, { date: string } & Record<string, number | string>>();
  [...metrics].reverse().forEach((metric) => {
    const key = metric.measuredAt.toISOString();
    const row = trendMap.get(key) ?? {
      date: metric.measuredAt.toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    };
    row[metric.serverAssetId] = diskUsagePercent(Number(metric.diskUsedGb), Number(metric.diskTotalGb));
    trendMap.set(key, row);
  });

  const trend = Array.from(trendMap.values());
  const trendSeries = perServerSummaries.map((server) => ({
    key: server.id,
    name: server.name,
    color: server.color
  }));

  const latestMetric = metrics[0];
  const latestDiskPercent = latestMetric
    ? diskUsagePercent(Number(latestMetric.diskUsedGb), Number(latestMetric.diskTotalGb))
    : null;

  return (
    <AppShell title="Server Metrics" subtitle="บันทึก CPU, RAM, Disk ของ VM Host และ Host">
      <div className="metrics-page">
        <ServerTypeFilter selectedType={selectedType} />

        {!report ? (
          <section className="card compact-card">
            <div className="section-heading">
              <div>
                <h2>สร้างรายงานเดือนนี้</h2>
                <p className="muted">ยังไม่มีรายงานเดือน {thaiMonthLabel(month, buddhistYear)} กรุณาสร้างก่อนบันทึก metric</p>
              </div>
              <form action={ensureReportAction}>
                <input type="hidden" name="month" value={month} />
                <input type="hidden" name="buddhistYear" value={buddhistYear} />
                <button className="button" type="submit">สร้างรายงาน</button>
              </form>
            </div>
          </section>
        ) : (
          <section className="card metric-entry-card">
            <div className="section-heading">
              <div>
                <h2>บันทึก Metrics</h2>
                <p className="muted">เลือก {categoryLabels[categoryCode]} แล้วกรอกค่าการใช้งานล่าสุด</p>
              </div>
              <span className="badge">{thaiMonthLabel(month, buddhistYear)}</span>
            </div>

            {searchParams.error === "metric" ? (
              <p className="form-error">ข้อมูล metric ไม่ถูกต้อง กรุณาตรวจ CPU/RAM/Disk อีกครั้ง</p>
            ) : null}
            {searchParams.error === "asset-total" ? (
              <p className="form-error">ไม่พบค่า RAM หรือ DISK รวมในบัญชีทรัพย์สิน กรุณาแก้ข้อมูลรายการนั้นก่อนบันทึก Metrics</p>
            ) : null}
            {searchParams.error === "metric-not-found" ? (
              <p className="form-error">ไม่พบประวัติ Metrics ที่ต้องการจัดการ</p>
            ) : null}

            <ServerMetricForm
              key={selectedType}
              reportId={report.id}
              returnTo={returnTo}
              categoryLabel={categoryLabels[categoryCode]}
              servers={serverOptions}
              lastMetrics={Object.fromEntries(
                Array.from(latestMetricByServer.entries()).map(([id, m]) => [
                  id,
                  { ramUsedGb: Number(m.ramUsedGb), diskUsedGb: Number(m.diskUsedGb), cpuPercent: Number(m.cpuPercent) }
                ])
              )}
            />
          </section>
        )}

        <div className="metrics-summary-grid">
          <section className="card compact-card stat-card">
            <span className="muted">{categoryLabels[categoryCode]} Active</span>
            <span className="stat-value">{servers.length}</span>
            <span className="muted">รายการที่พร้อมบันทึก Metrics</span>
          </section>
          <section className="card compact-card stat-card">
            <span className="muted">บันทึกล่าสุด</span>
            <span className="stat-value">{metrics.length}</span>
            <span className="muted">รายการประวัติล่าสุดที่แสดง</span>
          </section>
          <section className="card compact-card stat-card">
            <span className="muted">Disk ล่าสุด</span>
            <span className="stat-value">{latestDiskPercent === null ? "-" : `${latestDiskPercent}%`}</span>
            <span className="muted">จาก metric ล่าสุด</span>
          </section>
        </div>

        <section className="card">
          <div className="section-heading">
            <div>
              <h2>แนวโน้ม Disk Usage ราย Server</h2>
              <p className="muted">แยกสีและเส้นตาม {categoryLabels[categoryCode]} จากประวัติ metric ล่าสุด</p>
            </div>
          </div>
          {perServerSummaries.length > 0 ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 18 }}>
                {perServerSummaries.map((server) => (
                  <div
                    key={server.id}
                    style={{
                      border: "1px solid var(--line)",
                      borderTop: `4px solid ${server.color}`,
                      borderRadius: 8,
                      padding: 14,
                      background: "#ffffff",
                      display: "grid",
                      gap: 8
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{server.name}</strong>
                      <span className={`badge ${(server.diskPercent ?? 0) >= 85 ? "locked" : ""}`}>
                        {server.diskPercent === null ? "-" : `${server.diskPercent}%`}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      CPU {server.cpuPercent ?? "-"}% / RAM {server.ramUsedGb ?? "-"} of {server.ramTotalGb ?? "-"} GB
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Disk {server.diskUsedGb ?? "-"} of {server.diskTotalGb ?? "-"} GB
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      ล่าสุด {server.measuredAt ? server.measuredAt.toLocaleString("th-TH") : "-"}
                    </div>
                  </div>
                ))}
              </div>
              <DiskTrendChart data={trend} series={trendSeries} />
            </>
          ) : (
            <div className="muted" style={{ border: "1px dashed var(--line)", borderRadius: 8, padding: "4rem 1rem", textAlign: "center" }}>
              ยังไม่มีข้อมูล Metrics สำหรับแสดงแนวโน้มราย server
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-heading">
            <div>
              <h2>ประวัติการบันทึก</h2>
              <p className="muted">รายการล่าสุดของ {categoryLabels[categoryCode]}</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันเวลา</th>
                  <th>{categoryLabels[categoryCode]}</th>
                  <th>CPU</th>
                  <th>RAM</th>
                  <th>Disk</th>
                  <th>รายละเอียด</th>
                  {canManageMetrics ? <th style={{ width: 180 }}>จัดการ</th> : null}
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.id}>
                    <td>{metric.measuredAt.toLocaleString("th-TH")}</td>
                    <td>{metric.serverAsset.name}</td>
                    <td>{Number(metric.cpuPercent)}%</td>
                    <td>{Number(metric.ramUsedGb)} / {Number(metric.ramTotalGb)} GB</td>
                    <td>{Number(metric.diskUsedGb)} / {Number(metric.diskTotalGb)} GB ({diskUsagePercent(Number(metric.diskUsedGb), Number(metric.diskTotalGb))}%)</td>
                    <td>{metric.note ?? "-"}</td>
                    {canManageMetrics ? (
                      <td>
                        <MetricHistoryActions
                          metric={{
                            id: metric.id,
                            serverAssetId: metric.serverAssetId,
                            measuredAt: dateTimeLocalValue(metric.measuredAt),
                            cpuPercent: Number(metric.cpuPercent),
                            ramUsedGb: Number(metric.ramUsedGb),
                            diskUsedGb: Number(metric.diskUsedGb),
                            note: metric.note ?? ""
                          }}
                          returnTo={returnTo}
                          categoryLabel={categoryLabels[categoryCode]}
                          serverOptions={historyServerOptions.map((server) => ({ id: server.id, name: server.name }))}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
