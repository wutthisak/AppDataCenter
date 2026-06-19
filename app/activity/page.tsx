import { AppShell } from "@/components/AppShell";
import { WorkloadDonutChart, UserWorkloadChart } from "@/components/DashboardCharts";
import { requireUser } from "@/lib/auth";
import {
  formatDuration,
  getTodayActivityStats,
  getTodayStatusStats,
  getWorkloadByCategory,
  getWorkloadByUser,
  getTodayWorkloadWarnings,
  STANDARD_DAILY_CAPACITY_MIN
} from "@/lib/activity";
import { ListChecks, Clock, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";

const VALID_DAYS = [1, 7, 14, 30] as const;
type ValidDays = typeof VALID_DAYS[number];

const THAI_MONTHS = [
  "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

function parseDays(value: string | undefined): ValidDays {
  const n = Number(value);
  return (VALID_DAYS as readonly number[]).includes(n) ? n as ValidDays : 7;
}

export default async function ActivityDashboardPage(
  props: {
    searchParams: Promise<{ days?: string; month?: string; year?: string }>;
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

  const [stats, statusStats, workloadByCat, workloadByUser, workloadWarnings] =
    await Promise.all([
      getTodayActivityStats(),
      getTodayStatusStats(),
      getWorkloadByCategory(since, until),
      getWorkloadByUser(since, until),
      getTodayWorkloadWarnings()
    ]);

  const FILTER_OPTIONS: { label: string; value: number }[] = [
    { label: "วันนี้", value: 1 },
    { label: "7 วัน", value: 7 },
    { label: "14 วัน", value: 14 },
    { label: "30 วัน", value: 30 },
  ];

  return (
    <AppShell title="สรุปกิจกรรม" subtitle="Activity Dashboard — ภาพรวมกิจกรรมและภาระงานวันนี้">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* ── KPI Row ── */}
        <div className="exec-kpi-grid">
          <div className="exec-kpi-card" style={{ borderTop: "3px solid #2563eb" }}>
            <div className="exec-kpi-icon" style={{ background: "#eff6ff" }}>
              <ListChecks size={18} color="#2563eb" />
            </div>
            <div className="exec-kpi-body">
              <div className="exec-kpi-label">Activity วันนี้</div>
              <div className="exec-kpi-value">{stats.activityCount}</div>
              <div className="exec-kpi-sub">รายการกิจกรรมทั้งหมด</div>
            </div>
          </div>

          <div className="exec-kpi-card" style={{ borderTop: "3px solid #7c3aed" }}>
            <div className="exec-kpi-icon" style={{ background: "#f5f3ff" }}>
              <Clock size={18} color="#7c3aed" />
            </div>
            <div className="exec-kpi-body">
              <div className="exec-kpi-label">Estimated Workload</div>
              <div className="exec-kpi-value">{formatDuration(stats.totalDurationMin)}</div>
              <div className="exec-kpi-sub">ภาระงานประมาณการวันนี้</div>
            </div>
          </div>

          <div className="exec-kpi-card" style={{ borderTop: "3px solid #10b981" }}>
            <div className="exec-kpi-icon" style={{ background: "#f0fdf4" }}>
              <CheckCircle size={18} color="#10b981" />
            </div>
            <div className="exec-kpi-body">
              <div className="exec-kpi-label">ปกติ</div>
              <div className="exec-kpi-value" style={{ color: "#10b981" }}>{statusStats.normalCount}</div>
              <div className="exec-kpi-sub">รายการสถานะปกติวันนี้</div>
            </div>
          </div>

          <div className="exec-kpi-card" style={{ borderTop: statusStats.abnormalCount > 0 ? "3px solid #ef4444" : "3px solid #e5e7eb" }}>
            <div className="exec-kpi-icon" style={{ background: statusStats.abnormalCount > 0 ? "#fef2f2" : "#f9fafb" }}>
              <AlertTriangle size={18} color={statusStats.abnormalCount > 0 ? "#ef4444" : "#9ca3af"} />
            </div>
            <div className="exec-kpi-body">
              <div className="exec-kpi-label">พบปัญหา</div>
              <div className="exec-kpi-value" style={{ color: statusStats.abnormalCount > 0 ? "#ef4444" : "var(--text)" }}>
                {statusStats.abnormalCount}
              </div>
              <div className="exec-kpi-sub">รายการผิดปกติวันนี้</div>
            </div>
          </div>
        </div>

        {/* ── Workload Warning Banner ── */}
        {workloadWarnings.length > 0 && (
          <div style={{ background: "linear-gradient(135deg,#fff7ed 0%,#fef3c7 100%)", border: "1px solid #fcd34d", borderRadius: 12, padding: "1rem 1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <AlertTriangle size={16} color="#d97706" />
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                ⚠ Workload เกิน Capacity ({STANDARD_DAILY_CAPACITY_MIN} นาที/วัน)
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {workloadWarnings.map((w) => (
                <div key={w.name} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem" }}>
                  <span style={{ fontWeight: 700, color: "#7c2d12", minWidth: 140 }}>{w.name}</span>
                  <div style={{ flex: 1, background: "#fecaca", borderRadius: 999, height: 8, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(w.pct, 100)}%`, background: "#ef4444", height: "100%", borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#991b1b", minWidth: 80, textAlign: "right" }}>
                    {w.totalMin} / {STANDARD_DAILY_CAPACITY_MIN} min
                  </span>
                  <span style={{ background: "#fecaca", color: "#991b1b", borderRadius: 6, padding: "0.15rem 0.55rem", fontSize: "0.78rem", fontWeight: 800 }}>
                    {w.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Workload Section Header + Filter ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp size={17} color="var(--primary)" />
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>Workload Overview</span>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginLeft: 4 }}>({rangeLabel})</span>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            {/* Monthly filter */}
            <form method="get" style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <select name="month" defaultValue={selectedMonth} style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", borderRadius: 8 }}>
                {THAI_MONTHS.slice(1).map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select name="year" defaultValue={selectedYear} style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", borderRadius: 8 }}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button type="submit" className="exec-filter-pill exec-filter-pill--active" style={{ borderRadius: 8, padding: "0.25rem 0.75rem", cursor: "pointer", border: "none" }}>ดูเดือน</button>
            </form>
            {/* Days quick filter */}
            <div className="exec-filter-pills">
              {FILTER_OPTIONS.map((opt) => (
                <a
                  key={opt.value}
                  href={`/activity?days=${opt.value}`}
                  className={"exec-filter-pill" + (!isMonthlyMode && days === opt.value ? " exec-filter-pill--active" : "")}
                >
                  {opt.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Workload by Category + Workload by User ── */}
        <div className="grid grid-2">
          {/* Left: Donut chart */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Workload by Category</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>สัดส่วนเวลางานแต่ละหมวด ({rangeLabel})</p>
            </div>
            {workloadByCat.length > 0 ? (
              <WorkloadDonutChart data={workloadByCat} />
            ) : (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)", fontSize: "0.875rem" }}>ยังไม่มีข้อมูล</div>
            )}
          </div>

          {/* Right: User workload with progress bars */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Workload by User</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>ภาระงานต่อผู้ปฏิบัติงาน ({rangeLabel})</p>
            </div>
            {workloadByUser.length > 0 ? (
              <>
                <UserWorkloadChart data={workloadByUser} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "1.25rem" }}>
                  {workloadByUser.map((u) => {
                    const pct = Math.min(Math.round((u.totalMin / STANDARD_DAILY_CAPACITY_MIN) * 100), 200);
                    const exceeded = u.totalMin > STANDARD_DAILY_CAPACITY_MIN;
                    const barColor = exceeded ? "#ef4444" : "#10b981";
                    const trackColor = exceeded ? "#fecaca" : "#bbf7d0";
                    return (
                      <div key={u.name}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>{u.name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.82rem", color: exceeded ? "#ef4444" : "var(--text)", fontWeight: exceeded ? 700 : 400 }}>
                              {formatDuration(u.totalMin)}
                            </span>
                            <span style={{
                              fontSize: "0.72rem", fontWeight: 700, borderRadius: 6, padding: "0.12rem 0.45rem",
                              background: exceeded ? "#fecaca" : "#dcfce7",
                              color: exceeded ? "#991b1b" : "#166534"
                            }}>
                              {exceeded ? `⚠ ${pct}%` : "ปกติ"}
                            </span>
                          </div>
                        </div>
                        <div style={{ background: trackColor, borderRadius: 999, height: 7, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(pct, 100)}%`, background: barColor, height: "100%", borderRadius: 999, transition: "width 0.4s" }} />
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                          {u.activityCount} รายการ · {u.totalMin} / {STANDARD_DAILY_CAPACITY_MIN} นาที
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)", fontSize: "0.875rem" }}>ยังไม่มีข้อมูล</div>
            )}
          </div>
        </div>

      </div>
    </AppShell>
  );
}
