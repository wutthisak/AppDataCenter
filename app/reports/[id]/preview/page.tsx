import { notFound } from "next/navigation";
import { PrintControls } from "@/app/reports/[id]/preview/PrintControls";
import { allowedStatusCodes, categoryLabels, statusLabels } from "@/lib/constants";
import { thaiMonthLabel } from "@/lib/date";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AssetCategoryCode } from "@prisma/client";

function normalizeCategory(value?: string): AssetCategoryCode | null {
  const category = String(value ?? "").toUpperCase();
  return category === "VM" || category === "SERVER" || category === "NETWORK" || category === "BACKUP"
    ? category
    : null;
}

async function getReport(id: string, categoryCode: AssetCategoryCode | null) {
  const report = await prisma.monthlyReport.findUnique({
    where: { id },
    include: {
      entries: true,
      metrics: { include: { serverAsset: true }, orderBy: { measuredAt: "asc" } }
    }
  });
  if (!report) return null;

  const categories = await prisma.assetCategory.findMany({
    where: categoryCode ? { code: categoryCode } : undefined,
    orderBy: { displayOrder: "asc" },
    include: {
      assets: {
        where: {
          OR: [
            { active: true },
            { entries: { some: { reportId: report.id } } }
          ]
        },
        orderBy: { displayOrder: "asc" }
      }
    }
  });

  return { ...report, categories };
}

export default async function ReportPreviewPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ category?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  await requireUser();

  const categoryCode = normalizeCategory(searchParams?.category);
  const report = await getReport(params.id, categoryCode);
  if (!report) notFound();

  const entryMap = new Map(report.entries.map((entry) => [`${entry.assetId}:${entry.day}`, entry.statusCode]));
  const period = thaiMonthLabel(report.month, report.buddhistYear);

  return (
    <main className="print-preview-page">
      <div className="preview-toolbar no-print">
        <div>
          <div className="eyebrow">Report Preview</div>
          <h1>ดูตัวอย่างรายงานก่อนพิมพ์</h1>
          <p className="muted">ตรวจรูปแบบรายงานเดือน {period} แล้วเลือกพิมพ์หรือ Save เป็น PDF</p>
        </div>
        <PrintControls reportId={report.id} categoryCode={categoryCode} />
      </div>

      <div className="print-document">
        {report.categories.map((category) => (
          <section className="print-page" key={category.id}>
            <h2>{categoryLabels[category.code]}</h2>
            <div className="print-period">เดือน {period}</div>
            <table className="print-table">
              <thead>
                <tr>
                  <th className="print-no">ลำดับ</th>
                  <th className="print-name">รายการ</th>
                  {Array.from({ length: 31 }, (_, index) => <th key={index + 1}>{index + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {category.assets.map((asset) => (
                  <tr key={asset.id}>
                    <td className="print-no">{asset.displayOrder}</td>
                    <td className="print-name">{asset.name}</td>
                    {Array.from({ length: 31 }, (_, index) => {
                      const day = index + 1;
                      return <td key={day}>{entryMap.get(`${asset.id}:${day}`) ?? ""}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="print-legend">
              {allowedStatusCodes(category.code).map((code) => `${code} = ${statusLabels[code]}`).join("   ")}
            </div>
            <div className="print-signatures">
              <span>ผู้ปฏิบัติงาน..................................................</span>
              <span>ผู้ปฏิบัติงาน..................................................</span>
            </div>
          </section>
        ))}

        {categoryCode ? null : (
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
          <div className="print-signatures">
            <span>ผู้ปฏิบัติงาน..................................................</span>
            <span>{report.reviewerName ?? ""}</span>
          </div>
        </section>
        )}
      </div>
    </main>
  );
}
