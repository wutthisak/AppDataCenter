import { notFound } from "next/navigation";
import { PrintControls } from "@/app/reports/[id]/preview/PrintControls";
import { allowedStatusCodes, categoryLabels, statusLabels } from "@/lib/constants";
import { thaiMonthLabel } from "@/lib/date";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isGeneratedBackupJobAssetCode } from "@/lib/assets";
import "./preview.css";
import type { AssetCategoryCode, AssetStatusCode } from "@prisma/client";

type PreviewAsset = {
  id: string;
  code: string | null;
  name: string;
  displayOrder: number;
};
type PreviewCategory = {
  id: string;
  code: AssetCategoryCode;
  name: string;
  displayOrder: number;
  assets: PreviewAsset[];
};

function isBackupJobAsset(asset: { code: string | null }): boolean {
  return isGeneratedBackupJobAssetCode(asset.code);
}

function normalizeCategory(value?: string): AssetCategoryCode | null {
  const category = String(value ?? "").toUpperCase();
  return category === "VM" || category === "SERVER" || category === "NETWORK" || category === "BACKUP"
    ? category
    : null;
}

function normalizeStatus(value: string | undefined, categoryCode: AssetCategoryCode | null): AssetStatusCode | null {
  const status = String(value ?? "").toUpperCase() as AssetStatusCode;
  const options = categoryCode ? allowedStatusCodes(categoryCode) : (Object.keys(statusLabels) as AssetStatusCode[]);
  return options.includes(status) ? status : null;
}

const PRINT_ROWS_PER_PAGE = 22;

function chunkPrintRows<T>(rows: T[], pageSize = PRINT_ROWS_PER_PAGE): T[][] {
  if (rows.length === 0) return [[]];

  const pages: T[][] = [];
  for (let index = 0; index < rows.length; index += pageSize) {
    pages.push(rows.slice(index, index + pageSize));
  }
  return pages;
}

function filterReportCategories(
  categories: Array<Omit<PreviewCategory, "code"> & { code: AssetCategoryCode }>
): PreviewCategory[] {
  return categories.map((category) => (
    category.code === "BACKUP"
      ? { ...category, assets: category.assets.filter((asset) => !isBackupJobAsset(asset)) }
      : category
  ));
}

async function getReport(
  id: string,
  categoryCode: AssetCategoryCode | null,
  statusCode: AssetStatusCode | null,
  period?: { month?: number; buddhistYear?: number }
) {
  const report = await prisma.monthlyReport.findUnique({
    where: period?.month && period?.buddhistYear
      ? { month_buddhistYear: { month: period.month, buddhistYear: period.buddhistYear } }
      : { id },
    include: {
      entries: statusCode ? { where: { statusCode } } : true,
      metrics: { include: { serverAsset: true }, orderBy: { measuredAt: "asc" } }
    }
  });
  if (!report) return null;

  const categories = await prisma.assetCategory.findMany({
    where: categoryCode ? { code: categoryCode } : undefined,
    orderBy: { displayOrder: "asc" },
    include: {
      assets: {
        where: statusCode
          ? { entries: { some: { reportId: report.id, statusCode } } }
          : {
              OR: [
                { active: true },
                { entries: { some: { reportId: report.id } } }
              ]
            },
        orderBy: { displayOrder: "asc" }
      }
    }
  });

  return { ...report, categories: filterReportCategories(categories) };
}

export default async function ReportPreviewPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ category?: string; status?: string; month?: string; buddhistYear?: string; returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  await requireUser();

  const categoryCode = normalizeCategory(searchParams?.category);
  const statusCode = normalizeStatus(searchParams?.status, categoryCode);
  const selectedMonth = Number(searchParams?.month);
  const selectedBuddhistYear = Number(searchParams?.buddhistYear);
  const periodFilter = Number.isInteger(selectedMonth) && selectedMonth >= 1 && selectedMonth <= 12
    && Number.isInteger(selectedBuddhistYear) && selectedBuddhistYear > 0
    ? { month: selectedMonth, buddhistYear: selectedBuddhistYear }
    : undefined;
  const returnTo = searchParams?.returnTo ? decodeURIComponent(searchParams.returnTo) : null;
  const report = await getReport(
    params.id,
    categoryCode,
    statusCode,
    periodFilter
  );
  if (!report) notFound();

  const entryMap = new Map(report.entries.map((entry) => [`${entry.assetId}:${entry.day}`, entry.statusCode]));
  const period = thaiMonthLabel(report.month, report.buddhistYear);
  const categoryOptions = Object.entries(categoryLabels) as [AssetCategoryCode, string][];
  const statusOptions = categoryCode ? allowedStatusCodes(categoryCode) : (Object.keys(statusLabels) as AssetStatusCode[]);

  return (
    <main className="print-preview-page">
      <div className="preview-toolbar no-print">
        <div className="preview-toolbar-title">
          <div className="eyebrow">Report Preview</div>
          <h1>ดูตัวอย่างรายงานก่อนพิมพ์</h1>
          <p className="muted">ตรวจรูปแบบรายงานเดือน {period} แล้วเลือกพิมพ์หรือ Save เป็น PDF</p>
        </div>
        <form className="preview-filter-form" method="get">
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <label className="preview-filter-field">
            <span>รายเดือน</span>
            <select name="month" defaultValue={report.month}>
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={index + 1}>{index + 1}</option>
              ))}
            </select>
          </label>
          <label className="preview-filter-field preview-filter-year">
            <span>ปี พ.ศ.</span>
            <input name="buddhistYear" type="number" defaultValue={report.buddhistYear} />
          </label>
          <label className="preview-filter-field">
            <span>ประเภท</span>
            <select name="category" defaultValue={categoryCode ?? ""}>
              <option value="">ทุกประเภท</option>
              {categoryOptions.map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </label>
          <label className="preview-filter-field">
            <span>สถานะ</span>
            <select name="status" defaultValue={statusCode ?? ""}>
              <option value="">ทุกสถานะ</option>
              {statusOptions.map((code) => (
                <option key={code} value={code}>{code} - {statusLabels[code]}</option>
              ))}
            </select>
          </label>
          <button className="button filter-button" type="submit">กรอง</button>
        </form>
        <PrintControls reportId={report.id} categoryCode={categoryCode} returnTo={returnTo} />
      </div>

      <div className="print-document">
        {report.categories.flatMap((category) => {
          const categoryPages = chunkPrintRows(category.assets);

          return categoryPages.map((assets, pageIndex) => (
          <section className="print-page print-page--asset" key={`${category.id}:${pageIndex}`}>
            <header className="print-page-header">
              <div className="print-page-count">หน้า {pageIndex + 1}/{categoryPages.length}</div>
              <h2>{categoryLabels[category.code]}</h2>
              <div className="print-period">เดือน {period}</div>
              <div className="print-legend">
                {allowedStatusCodes(category.code).map((code) => (
                  <span className="print-legend-item" key={code}>
                    <strong>{code}</strong>
                    <span>{statusLabels[code]}</span>
                  </span>
                ))}
              </div>
            </header>
            <table className="print-table">
              <thead>
                <tr>
                  <th className="print-no">ลำดับ</th>
                  <th className="print-name">รายการ</th>
                  {Array.from({ length: 31 }, (_, index) => <th key={index + 1}>{index + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={33}>ไม่มีข้อมูลตามตัวกรอง</td>
                  </tr>
                ) : assets.map((asset, assetIndex) => (
                  <tr key={asset.id}>
                    <td className="print-no">
                      {asset.displayOrder}
                    </td>
                    <td className="print-name">{asset.name}</td>
                    {Array.from({ length: 31 }, (_, index) => {
                      const day = index + 1;
                      return <td key={day}>{entryMap.get(`${asset.id}:${day}`) ?? ""}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          ));
        })}

        {categoryCode || statusCode ? null : (
        <section className="print-page">
          <h2>รายงานสถานะ Server CPU / RAM / Disk</h2>
          <div className="print-period">เดือน {period}</div>
          <table className="print-table metrics-print-table">
            <thead>
              <tr><th>วันเวลา</th><th>Server</th><th>CPU</th><th>RAM</th><th>Disk</th><th>รายละเอียด</th></tr>
            </thead>
            <tbody>
              {report.metrics.length === 0 ? (
                <tr><td colSpan={6}>ไม่มีข้อมูล</td></tr>
              ) : report.metrics.map((metric) => (
                <tr key={metric.id}>
                  <td>{metric.measuredAt.toLocaleString("th-TH")}</td>
                  <td>{metric.serverAsset.name}</td>
                  <td>{metric.cpuPercent.toString()}%</td>
                  <td>{metric.ramUsedGb.toString()} / {metric.ramTotalGb.toString()} GB</td>
                  <td>{metric.diskUsedGb.toString()} / {metric.diskTotalGb.toString()} GB</td>
                  <td>{metric.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        )}
      </div>
    </main>
  );
}
