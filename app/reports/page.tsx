import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ResetReportDataButton } from "@/components/ResetReportDataButton";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { thaiMonthLabel, daysInThaiMonth } from "@/lib/date";
import { categoryLabels } from "@/lib/constants";
import { generatedBackupJobAssetExclusion } from "@/lib/assets";
import { FileText, Filter, Server, Network, Database, HardDrive } from "lucide-react";
import type { AssetCategoryCode, ReportStatus } from "@prisma/client";

const CATEGORY_CODES: AssetCategoryCode[] = ["VM", "SERVER", "NETWORK", "STORAGE", "BACKUP"];
const CATEGORY_COLORS: Record<AssetCategoryCode, string> = {
  VM: "#2563eb", SERVER: "#0891b2", NETWORK: "#7c3aed", STORAGE: "#0f766e", BACKUP: "#d97706",
};
const CATEGORY_BG: Record<AssetCategoryCode, string> = {
  VM: "#eff6ff", SERVER: "#ecfeff", NETWORK: "#f5f3ff", STORAGE: "#ecfdf5", BACKUP: "#fffbeb",
};
const CATEGORY_ICONS: Record<AssetCategoryCode, React.ReactNode> = {
  VM: <Server size={13} />,
  SERVER: <HardDrive size={13} />,
  NETWORK: <Network size={13} />,
  STORAGE: <HardDrive size={13} />,
  BACKUP: <Database size={13} />,
};

function pctColor(value: number) {
  if (value >= 90) return "#059669";
  if (value >= 70) return "#2563eb";
  if (value >= 40) return "#d97706";
  return "#dc2626";
}
function pctBg(value: number) {
  if (value >= 90) return "#dcfce7";
  if (value >= 70) return "#dbeafe";
  if (value >= 40) return "#fef3c7";
  return "#fee2e2";
}

function normMonth(v?: string) {
  const n = Number(v ?? "");
  return n >= 1 && n <= 12 ? n : 0;
}
function normYear(v?: string) {
  const n = Number(v ?? "");
  return n > 2400 ? n : 0;
}
function normCategory(v?: string): AssetCategoryCode | "" {
  return CATEGORY_CODES.includes(v as AssetCategoryCode) ? (v as AssetCategoryCode) : "";
}
function normStatus(v?: string) {
  return v === "OPEN" || v === "LOCKED" ? v : "";
}

export default async function ReportsPage(props: {
  searchParams?: Promise<{ month?: string; year?: string; category?: string; status?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await requireUser();

  const filterMonth = normMonth(searchParams?.month);
  const filterYear = normYear(searchParams?.year);
  const filterCategory = normCategory(searchParams?.category);
  const filterStatus = normStatus(searchParams?.status);

  const reports = await prisma.monthlyReport.findMany({
    where: {
      ...(filterMonth ? { month: filterMonth } : {}),
      ...(filterYear ? { buddhistYear: filterYear } : {}),
      ...(filterStatus ? { status: filterStatus as ReportStatus } : {}),
    },
    orderBy: [{ buddhistYear: "desc" }, { month: "desc" }],
  });

  // Per-category asset counts. Exclude generated backup-job assets from the Database category.
  const categoryAssetCounts = await Promise.all(
    CATEGORY_CODES.map(async (code) => ({
      code,
      count: await prisma.asset.count({
        where: {
          active: true,
          category: { code },
          ...generatedBackupJobAssetExclusion(code),
        },
      }),
    }))
  );
  const assetCountMap = Object.fromEntries(
    categoryAssetCounts.map((c) => [c.code, c.count])
  ) as Record<AssetCategoryCode, number>;

  // Per-report per-category entry counts
  const reportsWithCoverage = await Promise.all(
    reports.map(async (report) => {
      const totalDays = daysInThaiMonth(report.month, report.buddhistYear);

      const categoryCoverage = await Promise.all(
        CATEGORY_CODES.map(async (code) => {
          const assetCount = assetCountMap[code] ?? 0;
          const expected = assetCount * totalDays;
          const recorded = await prisma.dailyStatusEntry.count({
            where: {
              reportId: report.id,
              asset: {
                category: { code },
                ...generatedBackupJobAssetExclusion(code),
              },
            }
          });
          const pct = expected > 0 ? Math.round((recorded / expected) * 100) : 0;
          return { code, recorded, expected, pct, assetCount };
        })
      );

      const totalRecorded = categoryCoverage.reduce((s: number, c: { recorded: number }) => s + c.recorded, 0);
      const totalExpected = categoryCoverage.reduce((s: number, c: { expected: number }) => s + c.expected, 0);
      const overallPct = totalExpected > 0 ? Math.round((totalRecorded / totalExpected) * 100) : 0;
      return {
        id: report.id,
        month: report.month,
        buddhistYear: report.buddhistYear,
        status: report.status,
        reviewerName: report.reviewerName,
        updatedAt: report.updatedAt,
        categoryCoverage,
        totalRecorded,
        totalExpected,
        overallPct,
      };
    })
  );

  const activeCatFilter = filterCategory as AssetCategoryCode | "";

  // Filter by category (hide rows where category has 0 assets only if filtering)
  const filtered = activeCatFilter
    ? reportsWithCoverage.filter((r) =>
        r.categoryCoverage.find((c: { code: string; assetCount: number }) => c.code === activeCatFilter)?.assetCount ?? 0 > 0
      )
    : reportsWithCoverage;

  // Available years for filter
  const allYears = [...new Set(reportsWithCoverage.map((r) => r.buddhistYear))].sort((a, b) => b - a);

  const hasFilter = filterMonth || filterYear || filterCategory || filterStatus;

  return (
    <AppShell title="Monthly Operations" subtitle="สรุปผลการปฏิบัติงานประจำเดือน" hideTopbar>
      <div className="reports-page">
        {/* Hero */}
        <section className="reports-hero">
          <div className="reports-hero-content">
            <div className="reports-hero-icon">
              <FileText size={28} />
            </div>
            <div>
              <h2>📋 รายงานประจำเดือน</h2>
              <p>สรุปผลการปฏิบัติงานประจำเดือน แสดงความครบถ้วนของข้อมูลที่บันทึกแยกตามหมวด</p>
            </div>
          </div>
        </section>

        {/* Filter */}
        <section className="reports-search-card">
          <form className="reports-search-form" method="get">
            <div className="reports-search-field">
              <label>เดือน</label>
              <select name="month" defaultValue={filterMonth || ""}>
                <option value="">ทุกเดือน</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
            <div className="reports-search-field">
              <label>ปี พ.ศ.</label>
              <select name="year" defaultValue={filterYear || ""}>
                <option value="">ทุกปี</option>
                {allYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="reports-search-field">
              <label>ประเภท</label>
              <select name="category" defaultValue={filterCategory}>
                <option value="">ทุกประเภท</option>
                {CATEGORY_CODES.map((code) => (
                  <option key={code} value={code}>{categoryLabels[code]}</option>
                ))}
              </select>
            </div>
            <div className="reports-search-field">
              <label>สถานะรายงาน</label>
              <select name="status" defaultValue={filterStatus}>
                <option value="">ทุกสถานะ</option>
                <option value="OPEN">เปิดอยู่</option>
                <option value="LOCKED">ล็อกแล้ว</option>
              </select>
            </div>
            <div className="reports-search-actions">
              <button className="button" type="submit" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Filter size={14} /> กรอง
              </button>
              {hasFilter && (
                <Link className="button secondary" href="/reports">ล้าง</Link>
              )}
            </div>
          </form>
        </section>

        {/* Cards */}
        <section className="reports-cards-section">
          {filtered.length === 0 ? (
            <div className="reports-empty">
              <FileText size={32} />
              <p>ไม่พบรายงานที่ตรงกับเงื่อนไข</p>
            </div>
          ) : (
            <div className="reports-card-list">
              {filtered.map((report) => {
                const displayCats: Array<{ code: AssetCategoryCode; recorded: number; expected: number; pct: number; assetCount: number }> = activeCatFilter
                  ? report.categoryCoverage.filter((c: { code: string }) => c.code === activeCatFilter)
                  : report.categoryCoverage;
                const isLocked = report.status === "LOCKED";
                return (
                  <div key={report.id} className="rpt-card">
                    {/* Card header */}
                    <div className="rpt-card-header">
                      <div className="rpt-card-title-group">
                        <span className="rpt-card-month">{thaiMonthLabel(report.month, report.buddhistYear)}</span>
                        <span className={`rpt-status-badge ${isLocked ? "locked" : "open"}`}>
                          {isLocked ? "🔒 ล็อกแล้ว" : "🟢 เปิดอยู่"}
                        </span>
                      </div>
                      <div className="rpt-card-meta">
                        <span>อัปเดต {report.updatedAt.toLocaleDateString("th-TH")}</span>
                        <span className="rpt-overall-badge" style={{ background: pctBg(report.overallPct), color: pctColor(report.overallPct) }}>
                          รวม {report.overallPct}%
                        </span>
                      </div>
                    </div>

                    {/* Category bars */}
                    <div className="rpt-cat-grid">
                      {displayCats.map((cat: { code: AssetCategoryCode; recorded: number; expected: number; pct: number; assetCount: number }) => (
                        <div key={cat.code} className="rpt-cat-item" style={{ borderColor: CATEGORY_COLORS[cat.code] + "33" }}>
                          <div className="rpt-cat-label" style={{ color: CATEGORY_COLORS[cat.code] }}>
                            <span className="rpt-cat-icon" style={{ background: CATEGORY_BG[cat.code], color: CATEGORY_COLORS[cat.code] }}>
                              {CATEGORY_ICONS[cat.code]}
                            </span>
                            {categoryLabels[cat.code]}
                          </div>
                          <div className="rpt-bar-wrap">
                            <div className="rpt-bar-track">
                              <div className="rpt-bar-fill" style={{ width: `${Math.min(cat.pct, 100)}%`, background: pctColor(cat.pct) }} />
                            </div>
                            <span className="rpt-bar-pct" style={{ color: pctColor(cat.pct) }}>{cat.pct}%</span>
                          </div>
                          <div className="rpt-cat-count">{cat.recorded}/{cat.expected}</div>
                        </div>
                      ))}

                    </div>

                    {/* Actions */}
                    <div className="rpt-card-footer">
                      <Link
                        href={`/reports/${report.id}/official`}
                        target="_blank"
                        className="rpt-btn-official"
                      >
                        📋 รายงานทางการ
                      </Link>
                      <Link
                        href={`/?mode=monthly&month=${report.month}&buddhistYear=${report.buddhistYear}`}
                        className="rpt-btn-detail"
                      >
                        📊 ดู Dashboard
                      </Link>
                      {user.role === "ADMIN" && (
                        <ResetReportDataButton
                          reportId={report.id}
                          month={report.month}
                          buddhistYear={report.buddhistYear}
                          monthLabel={thaiMonthLabel(report.month, report.buddhistYear)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
