import { AppShell } from "@/components/AppShell";
import { MonthlyActivityBarChart } from "@/components/DashboardCharts";
import { requireUser } from "@/lib/auth";
import {
  formatDuration,
  getMonthlyStats,
  getMonthlyActivityTrend,
  getTopCategoryForMonth,
  getTopActivitiesForMonth,
  getMonthlyStatusStats,
  getMonthlyMetricStats
} from "@/lib/activity";
import { AlertTriangle, BarChart2, CheckCircle, Clock, Server, Users } from "lucide-react";
import { PrintButton } from "@/components/PrintButton";

const THAI_MONTHS = [
  "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

export default async function ActivityReportPage(
  props: {
    searchParams: Promise<{ month?: string; year?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await requireUser();

  const now = new Date();
  const buddhistYear = now.getFullYear() + 543;
  const selectedYear = parseInt(searchParams.year || String(buddhistYear));
  const selectedMonth = parseInt(searchParams.month || String(now.getMonth() + 1));

  const [stats, trend, topCategory, topActivities, statusStats, metricStats] = await Promise.all([
    getMonthlyStats(selectedYear, selectedMonth),
    getMonthlyActivityTrend(selectedYear, selectedMonth),
    getTopCategoryForMonth(selectedYear, selectedMonth),
    getTopActivitiesForMonth(selectedYear, selectedMonth),
    getMonthlyStatusStats(selectedYear, selectedMonth),
    getMonthlyMetricStats(selectedYear, selectedMonth)
  ]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => buddhistYear - i);

  return (
    <AppShell
      title="รายงานผู้บริหาร"
      subtitle={`Executive Monthly Report — ${THAI_MONTHS[selectedMonth]} ${selectedYear}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Filter bar */}
        <form method="get" style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <select name="month" defaultValue={selectedMonth} style={{ minWidth: 130 }}>
            {THAI_MONTHS.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select name="year" defaultValue={selectedYear} style={{ minWidth: 100 }}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button className="button" type="submit" style={{ padding: "0.4rem 1.2rem", fontSize: "0.875rem" }}>ดูรายงาน</button>
        </form>

        {/* Report header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
              {THAI_MONTHS[selectedMonth]} {selectedYear} — ภาพรวมทุก Data Center
            </h2>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>สรุปภาพรวมกิจกรรมประจำเดือน</p>
          </div>
          <PrintButton label="🖨 พิมพ์รายงาน" />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-4">
          <div className="card stat-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Inspection สำเร็จ</span>
              <span style={{ background: "#f0fdf4", borderRadius: 8, padding: "0.35rem", display: "flex" }}><CheckCircle size={16} color="#10b981" /></span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{stats.completionPct}%</div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>ความครบถ้วนการตรวจสอบ</div>
          </div>

          <div className="card stat-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Activity</span>
              <span style={{ background: "#eff6ff", borderRadius: 8, padding: "0.35rem", display: "flex" }}><BarChart2 size={16} color="#2563eb" /></span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{stats.activityCount.toLocaleString()}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>รายการกิจกรรมทั้งเดือน</div>
          </div>

          <div className="card stat-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>ภาระงานประมาณการ</span>
              <span style={{ background: "#f5f3ff", borderRadius: 8, padding: "0.35rem", display: "flex" }}><Clock size={16} color="#7c3aed" /></span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{formatDuration(stats.totalDurationMin)}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>Estimated Workload</div>
          </div>

          <div className="card stat-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>ผู้ปฏิบัติงาน</span>
              <span style={{ background: "#fff7ed", borderRadius: 8, padding: "0.35rem", display: "flex" }}><Users size={16} color="#f97316" /></span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{stats.activeUserCount} <span style={{ fontSize: "1rem", fontWeight: 500 }}>คน</span></div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>ผู้ปฏิบัติงานทั้งเดือน</div>
          </div>
        </div>

        {/* Two columns: BarChart + Top Activities */}
        <div className="grid grid-2">
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Activity รายวัน</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>{THAI_MONTHS[selectedMonth]} {selectedYear}</p>
            </div>
            {trend.length > 0 ? (
              <MonthlyActivityBarChart data={trend} />
            ) : (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)", fontSize: "0.875rem" }}>ยังไม่มีข้อมูล</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Top Category */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700 }}>หมวดงานหลัก</h3>
              {topCategory ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{
                    background: "var(--primary)",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "0.5rem 1.25rem",
                    fontSize: "1rem",
                    fontWeight: 700
                  }}>
                    {topCategory}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>หมวดที่มีกิจกรรมมากที่สุด</span>
                </div>
              ) : (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.875rem" }}>ยังไม่มีข้อมูล</p>
              )}
            </div>

            {/* Top 5 Activities */}
            <div className="card" style={{ padding: "1.5rem", flex: 1 }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }}>Top 5 Activity</h3>
              {topActivities.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>กิจกรรม</th>
                        <th style={{ textAlign: "right" }}>ครั้ง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topActivities.map((a, i) => (
                        <tr key={i}>
                          <td style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{i + 1}</td>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>{a.title}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{a.categoryName}</div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "var(--primary)" }}>{a.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.875rem" }}>ยังไม่มีข้อมูล</p>
              )}
            </div>
          </div>
        </div>

        {/* Monthly Daily Status Summary */}
        <div className="grid grid-4">
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CheckCircle size={15} color="var(--muted)" />
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>ตรวจสอบสถานะ Asset เดือนนี้</span>
          </div>
          <div className="card stat-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>บันทึกทั้งหมด</span>
              <span style={{ background: "#eff6ff", borderRadius: 8, padding: "0.35rem", display: "flex" }}><BarChart2 size={16} color="#2563eb" /></span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{statusStats.total}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>รายการสถานะเดือนนี้</div>
          </div>
          <div className="card stat-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>ปกติ</span>
              <span style={{ background: "#f0fdf4", borderRadius: 8, padding: "0.35rem", display: "flex" }}><CheckCircle size={16} color="#10b981" /></span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#10b981", lineHeight: 1 }}>{statusStats.normal}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>รายการปกติ</div>
          </div>
          <div className="card stat-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>ผิดปกติ</span>
              <span style={{ background: "#fef2f2", borderRadius: 8, padding: "0.35rem", display: "flex" }}><AlertTriangle size={16} color="#ef4444" /></span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: statusStats.abnormal > 0 ? "#ef4444" : "var(--text)", lineHeight: 1 }}>{statusStats.abnormal}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>รายการผิดปกติ</div>
          </div>
          <div className="card stat-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>อัตราปกติ</span>
              <span style={{ background: "#f0fdf4", borderRadius: 8, padding: "0.35rem", display: "flex" }}><CheckCircle size={16} color="#10b981" /></span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>
              {statusStats.total > 0 ? Math.round((statusStats.normal / statusStats.total) * 100) : 0}%
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>Normal rate</div>
          </div>
        </div>

        {/* Monthly Server Metrics Summary */}
        <div className="grid grid-4">
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Server size={15} color="var(--muted)" />
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Server Metrics เดือนนี้ (เฉลี่ย)</span>
          </div>
          <div className="card stat-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>การวัดทั้งหมด</span>
              <span style={{ background: "#f0f9ff", borderRadius: 8, padding: "0.35rem", display: "flex" }}><Server size={16} color="#0284c7" /></span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{metricStats.count}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>รายการวัดค่าเดือนนี้</div>
          </div>
          <div className="card stat-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg CPU</span>
              <span style={{ background: "#fef3c7", borderRadius: 8, padding: "0.35rem", display: "flex" }}><Server size={16} color="#d97706" /></span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: metricStats.avgCpu > 80 ? "#ef4444" : "var(--text)", lineHeight: 1 }}>{metricStats.avgCpu}%</div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>CPU เฉลี่ยเดือนนี้</div>
          </div>
          <div className="card stat-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg RAM</span>
              <span style={{ background: "#faf5ff", borderRadius: 8, padding: "0.35rem", display: "flex" }}><Server size={16} color="#7c3aed" /></span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: metricStats.avgRamPct > 85 ? "#ef4444" : "var(--text)", lineHeight: 1 }}>{metricStats.avgRamPct}%</div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>RAM เฉลี่ยเดือนนี้</div>
          </div>
          <div className="card stat-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg Disk</span>
              <span style={{ background: "#f0fdf4", borderRadius: 8, padding: "0.35rem", display: "flex" }}><Server size={16} color="#10b981" /></span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: metricStats.avgDiskPct > 85 ? "#ef4444" : "var(--text)", lineHeight: 1 }}>{metricStats.avgDiskPct}%</div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>Disk เฉลี่ยเดือนนี้</div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
