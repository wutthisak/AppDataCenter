import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { allowedStatusCodes, categoryLabels, statusLabels } from "@/lib/constants";
import { thaiMonthLabel } from "@/lib/date";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reportHtml(report: Awaited<ReturnType<typeof getReport>>) {
  if (!report) return "";
  const entryMap = new Map(report.entries.map((entry) => [`${entry.assetId}:${entry.day}`, entry.statusCode]));

  const sections = report.categories.map((category) => {
    const rows = category.assets
      .map((asset) => {
        const days = Array.from({ length: 31 }, (_, index) => {
          const day = index + 1;
          return `<td>${escapeHtml(entryMap.get(`${asset.id}:${day}`) ?? "")}</td>`;
        }).join("");
        return `<tr><td class="no">${asset.displayOrder}</td><td class="name">${escapeHtml(asset.name)}</td>${days}</tr>`;
      })
      .join("");
    const legend = allowedStatusCodes(category.code).map((code) => `${code} = ${statusLabels[code]}`).join(" &nbsp;&nbsp; ");
    return `
      <section class="page">
        <h1>${escapeHtml(categoryLabels[category.code])}</h1>
        <div class="period">เดือน ${escapeHtml(thaiMonthLabel(report.month, report.buddhistYear))}</div>
        <table>
          <thead>
            <tr><th class="no">ลำดับ</th><th class="name">รายการ</th>${Array.from({ length: 31 }, (_, i) => `<th>${i + 1}</th>`).join("")}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="legend">${legend}</div>
        <div class="signatures">
          <span>ผู้ปฏิบัติงาน..................................................</span>
          <span>ผู้ปฏิบัติงาน..................................................</span>
        </div>
      </section>
    `;
  }).join("");

  const metricRows = report.metrics.map((metric) => `
    <tr>
      <td>${escapeHtml(metric.measuredAt.toLocaleString("th-TH"))}</td>
      <td>${escapeHtml(metric.serverAsset.name)}</td>
      <td>${escapeHtml(metric.cpuPercent)}%</td>
      <td>${escapeHtml(metric.ramUsedGb)} / ${escapeHtml(metric.ramTotalGb)} GB</td>
      <td>${escapeHtml(metric.diskUsedGb)} / ${escapeHtml(metric.diskTotalGb)} GB</td>
      <td>${escapeHtml(metric.note ?? "")}</td>
    </tr>
  `).join("");

  return `
    <!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: Arial, "Noto Sans Thai", sans-serif; color: #111827; }
          h1 { text-align: center; font-size: 20px; margin: 0 0 6px; }
          .period { text-align: center; margin-bottom: 10px; }
          .page { page-break-after: always; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #111827; padding: 3px; text-align: center; min-width: 16px; height: 20px; }
          th { background: #eef2ff; }
          .no { width: 32px; }
          .name { width: 150px; text-align: left; }
          .legend { margin-top: 10px; font-size: 12px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 24px; font-size: 13px; }
          .metrics th, .metrics td { font-size: 11px; padding: 6px; }
        </style>
      </head>
      <body>
        ${sections}
        <section>
          <h1>รายงานสถานะ Server CPU / RAM / Disk</h1>
          <div class="period">เดือน ${escapeHtml(thaiMonthLabel(report.month, report.buddhistYear))}</div>
          <table class="metrics">
            <thead><tr><th>วันเวลา</th><th>Server</th><th>CPU</th><th>RAM</th><th>Disk</th><th>รายละเอียด</th></tr></thead>
            <tbody>${metricRows || `<tr><td colspan="6">ไม่มีข้อมูล</td></tr>`}</tbody>
          </table>
          <div class="signatures">
            <span>ผู้ปฏิบัติงาน..................................................</span>
            <span>${escapeHtml(report.reviewerName ?? "")}</span>
          </div>
        </section>
      </body>
    </html>
  `;
}

async function getReport(id: string) {
  const report = await prisma.monthlyReport.findUnique({
    where: { id },
    include: {
      entries: true,
      metrics: { include: { serverAsset: true }, orderBy: { measuredAt: "asc" } }
    }
  });
  if (!report) return null;
  const categories = await prisma.assetCategory.findMany({
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

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const report = await getReport(params.id);
  if (!report) return new NextResponse("Not found", { status: 404 });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(reportHtml(report), { waitUntil: "networkidle" });
  const pdf = await page.pdf({ format: "A4", landscape: true, printBackground: true });
  await browser.close();

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "EXPORT_PDF",
      entityType: "MonthlyReport",
      entityId: report.id
    }
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="monthly-report-${report.month}-${report.buddhistYear}.pdf"`
    }
  });
}
