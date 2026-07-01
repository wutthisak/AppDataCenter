import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ensureReportAction } from "@/app/actions";
import { canEditRole, requireUser } from "@/lib/auth";
import { allowedStatusCodes, categoryLabels } from "@/lib/constants";
import { assetCategoryRoutes, generatedBackupJobAssetExclusion, isGeneratedBackupJobAssetCode } from "@/lib/assets";
import { currentBuddhistYear, daysInThaiMonth, thaiMonthLabel } from "@/lib/date";
import { MonthlyReportView } from "@/components/MonthlyReportView";
import { DailyRecordingView } from "@/components/DailyRecordingView";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, CalendarDays, CheckCircle, Clock3, Monitor, Printer, ShieldCheck } from "lucide-react";

function selectedMonth(searchParams: { month?: string; buddhistYear?: string; range?: string; view?: string; day?: string }) {
  const now = new Date();
  const month = Number(searchParams.month ?? now.getMonth() + 1);
  const buddhistYear = Number(searchParams.buddhistYear ?? currentBuddhistYear());
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    buddhistYear: Number.isInteger(buddhistYear) && buddhistYear > 2400 ? buddhistYear : currentBuddhistYear()
  };
}

function selectedDay(searchParamsDay: string | undefined, month: number, buddhistYear: number, maxDay: number) {
  const now = new Date();
  const defaultDay = month === now.getMonth() + 1 && buddhistYear === now.getFullYear() + 543
    ? Math.min(now.getDate(), maxDay)
    : 1;
  if (!searchParamsDay) return defaultDay;
  // Support ISO date format (YYYY-MM-DD) from date input
  if (searchParamsDay.includes("-")) {
    const parts = searchParamsDay.split("-");
    const dayNum = Number(parts[2]);
    return Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= maxDay ? dayNum : defaultDay;
  }
  const day = Number(searchParamsDay);
  return Number.isInteger(day) && day >= 1 && day <= maxDay ? day : defaultDay;
}


export default async function DailyCategoryReportPage(
  props: {
    params: Promise<{ category: string }>;
    searchParams: Promise<{ month?: string; buddhistYear?: string; range?: string; view?: string; day?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const user = await requireUser();
  const code = assetCategoryRoutes[params.category];
  if (!code) notFound();

  const { month, buddhistYear } = selectedMonth(searchParams);
  const activeView = searchParams.view === "monthly" ? "monthly" : "daily";
  const range = searchParams.range === "2" ? 2 : 1;
  const baseUrl = `/reports/daily/${params.category}`;
  const period = thaiMonthLabel(month, buddhistYear);
  const maxDay = daysInThaiMonth(month, buddhistYear);
  const activeDay = selectedDay(searchParams.day, month, buddhistYear, maxDay);
  const returnTo = `${baseUrl}?month=${month}&buddhistYear=${buddhistYear}&view=${activeView}&range=${range}&day=${activeDay}`;

  const [report, category] = await Promise.all([
    prisma.monthlyReport.findUnique({ where: { month_buddhistYear: { month, buddhistYear } } }),
    prisma.assetCategory.findUnique({
      where: { code },
      include: {
        assets: {
          orderBy: { displayOrder: "asc" }
        }
      }
    })
  ]);

  if (!category) notFound();

  const assets = await prisma.asset.findMany({
    where: {
      categoryId: category.id,
      ...generatedBackupJobAssetExclusion(code),
      ...(report
        ? { OR: [{ active: true }, { entries: { some: { reportId: report.id } } }] }
        : { active: true }
      )
    },
    orderBy: { displayOrder: "asc" }
  });
  const assetIds = assets.map((asset) => asset.id);

  const entries = report
    ? await prisma.dailyStatusEntry.findMany({
        where: {
          reportId: report.id,
          assetId: { in: assetIds }
        },
        include: {
          recordedBy: { select: { displayName: true } },
          updatedBy: { select: { displayName: true } }
        }
      })
    : [];

  // Entry map keyed by `assetId:day` (new unique key)
  const entryMap = new Map<string, (typeof entries)[number]>(entries.map((entry) => [
    `${entry.assetId}:${entry.day}`,
    entry
  ]));

  const locked = report?.status === "LOCKED";
  const editable = Boolean(report) && canEditRole(user.role) && !locked;
  const options = allowedStatusCodes(code);
  const visibleDays = range === 1
    ? Array.from({ length: Math.min(15, maxDay) }, (_, index) => index + 1)
    : Array.from({ length: Math.max(maxDay - 15, 0) }, (_, index) => index + 16);

  const selectedDayEntries = entries.filter((e) => e.day === activeDay);
  const recordedAssetCount = selectedDayEntries.length;
  const totalAssetCount = assets.length;
  const remainingAssetCount = Math.max(totalAssetCount - recordedAssetCount, 0);
  const coveragePct = totalAssetCount > 0 ? Math.round((recordedAssetCount / totalAssetCount) * 100) : 0;
  const daysRecorded = new Set(entries.map((e) => e.day)).size;
  const reportState =
    daysRecorded === 0
      ? { label: "ยังไม่มีข้อมูล", tone: "empty" }
      : daysRecorded < maxDay
        ? { label: "มีข้อมูลบางส่วน", tone: "partial" }
        : { label: "บันทึกครบ", tone: "complete" };

  // View toggle hrefs
  const dailyHref = `${baseUrl}?month=${month}&buddhistYear=${buddhistYear}&view=daily&day=${activeDay}`;
  const monthlyHref = `${baseUrl}?month=${month}&buddhistYear=${buddhistYear}&view=monthly&range=${range}&day=${activeDay}`;
  const firstRangeHref = `${baseUrl}?month=${month}&buddhistYear=${buddhistYear}&view=monthly&range=1`;
  const secondRangeHref = `${baseUrl}?month=${month}&buddhistYear=${buddhistYear}&view=monthly&range=2`;
  const printHref = report
    ? `/reports/${report.id}/preview?${new URLSearchParams({
        category: code,
        month: String(month),
        buddhistYear: String(buddhistYear),
        returnTo
      }).toString()}`
    : null;

  return (
    <AppShell title={categoryLabels[code]} subtitle={`บันทึกสถานะรายวัน ${period}`} variant="daily-report" hideTopbar>
      <section className="daily-report-hero">
        <div className="daily-report-hero-main">
          <div className="daily-report-title-group">
            <div className="daily-report-title-icon">
              <Monitor size={26} />
            </div>
            <div>
              <div className="daily-report-kicker">Daily Status Recording</div>
              <h2>{categoryLabels[code]}</h2>
              <p>ผู้บันทึก: {user.displayName}</p>
            </div>
          </div>
          <div className={`daily-report-status daily-report-status--${reportState.tone}`}>
            <ShieldCheck size={16} />
            {reportState.label}
          </div>
        </div>

        <div className="daily-report-summary">
          <div className="daily-report-metric daily-report-metric--blue">
            <span className="daily-report-metric-icon"><Monitor size={18} /></span>
            <span className="daily-report-metric-label">{categoryLabels[code]} ทั้งหมด</span>
            <strong>{totalAssetCount}</strong>
          </div>
          <div className="daily-report-metric daily-report-metric--green">
            <span className="daily-report-metric-icon"><CheckCircle size={18} /></span>
            <span className="daily-report-metric-label">บันทึกแล้ววันที่เลือก</span>
            <strong>{recordedAssetCount}</strong>
          </div>
          <div className="daily-report-metric daily-report-metric--amber">
            <span className="daily-report-metric-icon"><Clock3 size={18} /></span>
            <span className="daily-report-metric-label">เหลือ</span>
            <strong>{remainingAssetCount}</strong>
          </div>
          <div className="daily-report-metric daily-report-metric--violet">
            <span className="daily-report-metric-icon"><ShieldCheck size={18} /></span>
            <span className="daily-report-metric-label">ความคืบหน้า</span>
            <strong>{coveragePct}%</strong>
          </div>
        </div>

        <div className="daily-report-toolbar">
          <form className="daily-report-period-form" action={ensureReportAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <CalendarDays size={18} />
            <select name="month" defaultValue={month}>
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={index + 1}>{index + 1}</option>
              ))}
            </select>
            <span>/</span>
            <input name="buddhistYear" type="number" defaultValue={buddhistYear} />
            <button className="daily-report-primary-button" type="submit">เปิดรอบ</button>
          </form>
          <div className="daily-report-view-tabs">
            <Link href={dailyHref} className={`daily-report-view-tab${activeView === "daily" ? " is-active" : ""}`}>
              Daily View
            </Link>
            <Link href={monthlyHref} className={`daily-report-view-tab${activeView === "monthly" ? " is-active" : ""}`}>
              Monthly View
            </Link>
          </div>
          <div className="daily-report-actions">
            {printHref && (
              <Link className="daily-report-print-button" href={printHref} target="_blank">
                <Printer size={16} />
                พิมพ์รายงาน
              </Link>
            )}
            <Link className="daily-report-back-link" href="/reports">
              <ArrowLeft size={15} />
              รายงาน
            </Link>
          </div>
        </div>

      </section>
      {!report && (
        <section className="card" style={{ padding: "14px 20px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, margin: "0 0 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#92400e", fontWeight: 700, fontSize: 13 }}>
            <span>⚠</span>
            <span>ยังไม่มีรายงานเดือน {period} — กรุณากดปุ่ม &ldquo;เปิดรอบ&rdquo; ด้านบนก่อนบันทึกสถานะ</span>
          </div>
        </section>
      )}
      {activeView === "daily" ? (
        /* ===== DAILY VIEW ===== */
        (<section className="card daily-entry-card" style={{ padding: "20px 20px" }}>
          <div className="daily-entry-heading" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "4px 12px" }}>
                วันที่ {activeDay} {period}
              </div>
            </div>
            <form className="daily-entry-day-form" method="get">
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="buddhistYear" value={buddhistYear} />
              <input type="hidden" name="view" value="daily" />
              <input type="hidden" name="range" value={range} />
              <label htmlFor="daily-report-day">วันที่</label>
              <input
                id="daily-report-day"
                type="date"
                name="day"
                defaultValue={`${buddhistYear - 543}-${String(month).padStart(2, "0")}-${String(activeDay).padStart(2, "0")}`}
                min={`${buddhistYear - 543}-${String(month).padStart(2, "0")}-01`}
                max={`${buddhistYear - 543}-${String(month).padStart(2, "0")}-${String(maxDay).padStart(2, "0")}`}
              />
              <button type="submit">เปิดวันที่</button>
            </form>
          </div>
          <DailyRecordingView
            reportId={report?.id ?? ""}
            categoryCode={code}
            assets={assets}
            day={activeDay}
            month={month}
            buddhistYear={buddhistYear}
            entries={selectedDayEntries}
            options={options}
            returnTo={returnTo}
            editable={Boolean(report) && editable}
            userId={user.id}
            userRole={user.role}
          />
        </section>)
      ) : (
        /* ===== MONTHLY VIEW ===== */
        (<section className="card monthly-ops-card">
          <MonthlyReportView
            reportId={report?.id ?? ""}
            categoryCode={code}
            assets={assets}
            month={month}
            buddhistYear={buddhistYear}
            range={range}
            maxDay={maxDay}
            firstRangeHref={firstRangeHref}
            secondRangeHref={secondRangeHref}
            visibleDays={visibleDays}
            entryMap={entryMap}
            options={options}
            returnTo={returnTo}
            editable={Boolean(report) && editable}
            userId={user.id}
            userRole={user.role}
          />
        </section>)
      )}
    </AppShell>
  );
}
