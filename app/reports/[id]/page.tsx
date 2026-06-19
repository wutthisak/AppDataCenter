import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { reviewReportAction } from "@/app/actions";
import { canEditRole, canReviewRole, requireUser } from "@/lib/auth";
import { allowedStatusCodes, categoryLabels, statusLabels } from "@/lib/constants";
import { daysInThaiMonth, thaiMonthLabel } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { StatusForm } from "@/components/StatusForm";

export default async function ReportDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ category?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const user = await requireUser();
  const report = await prisma.monthlyReport.findUnique({
    where: { id: params.id },
    include: {
      entries: true
    }
  });
  if (!report) notFound();

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

  const entryMap = new Map(report.entries.map((entry) => [entry.assetId + ":" + entry.day, entry]));
  const maxDay = daysInThaiMonth(report.month, report.buddhistYear);
  const locked = report.status === "LOCKED";
  const editable = canEditRole(user.role) && !locked;
  const reviewable = canReviewRole(user.role);
  const requestedCategory = String(searchParams.category ?? "").toUpperCase();
  const selectedCategoryCode = categories.some((category) => category.code === requestedCategory)
    ? requestedCategory
    : categories[0]?.code;
  const visibleCategories = selectedCategoryCode
    ? categories.filter((category) => category.code === selectedCategoryCode)
    : [];
  const returnTo = selectedCategoryCode
    ? "/reports/" + report.id + "?category=" + selectedCategoryCode
    : "/reports/" + report.id;
  const categorySummaries = categories.map((category) => {
    const assetIds = new Set(category.assets.map((asset) => asset.id));
    const totalChecks = category.assets.length * maxDay;
    const recordedChecks = report.entries.filter((entry) => assetIds.has(entry.assetId) && entry.day <= maxDay).length;
    const activeAssets = category.assets.filter((asset) => asset.active).length;
    const percent = totalChecks > 0 ? Math.round((recordedChecks / totalChecks) * 100) : 0;
    return { category, totalChecks, recordedChecks, activeAssets, percent };
  });
  const selectedSummary = categorySummaries.find((item) => item.category.code === selectedCategoryCode);

  return (
    <AppShell title="บันทึกรายงานรายวัน" subtitle={thaiMonthLabel(report.month, report.buddhistYear)}>
      <div className="toolbar">
        <div>
          {report.status !== "DRAFT" ? <span className={"badge " + (locked ? "locked" : "")}>{report.status}</span> : null}
          {report.reviewerName ? <span className="muted"> บันทึกโดย {report.reviewerName}</span> : null}
        </div>
        <Link
          className="button secondary"
          href={"/reports/" + report.id + "/preview" + (selectedCategoryCode ? "?category=" + selectedCategoryCode : "")}
          target="_blank"
        >
          ดูตัวอย่างก่อนพิมพ์
        </Link>
      </div>

      {reviewable ? (
        <section className="card" style={{ marginBottom: 18 }}>
          <form className="form-row" action={reviewReportAction}>
            <input type="hidden" name="reportId" value={report.id} />
            <label>
              ชื่อผู้บันทึกข้อมูล
              <input name="reviewerName" defaultValue={report.reviewerName ?? user.displayName} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10 }}>
              <input name="lock" type="checkbox" defaultChecked={locked} style={{ minHeight: 0 }} />
              ล็อกรายงานหลังตรวจ
            </label>
            <button className="button" type="submit">บันทึกผลตรวจ</button>
          </form>
        </section>
      ) : null}

      <section className="report-category-overview">
        <div className="section-heading report-category-overview-heading">
          <div>
            <h2>Filter ประเภทตรวจสอบ</h2>
            <p className="muted">เลือกทีละประเภทเพื่อตรวจสอบรายงานแบบไม่รก</p>
          </div>
          <span className="badge">แสดง {selectedSummary ? categoryLabels[selectedSummary.category.code] : "-"}</span>
        </div>

        <form className="report-category-filter" action={"/reports/" + report.id} method="get" key={selectedCategoryCode}>
          <label>
            ประเภทตรวจสอบ
            <select name="category" defaultValue={selectedCategoryCode ?? ""}>
              {categories.map((category) => (
                <option key={category.id} value={category.code}>{categoryLabels[category.code]}</option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">แสดงรายงาน</button>
        </form>

        <div className="report-category-tabs">
          {categorySummaries.map(({ category, activeAssets, recordedChecks, totalChecks, percent }) => {
            const active = category.code === selectedCategoryCode;
            return (
              <Link
                className={"report-category-tab tone-" + category.code.toLowerCase() + (active ? " active" : "")}
                href={"/reports/" + report.id + "?category=" + category.code}
                key={category.id}
              >
                <div>
                  <span className="report-category-tab-label">{categoryLabels[category.code]}</span>
                  <span className="report-category-tab-meta">{activeAssets} active / {category.assets.length} รายการ</span>
                </div>
                <div className="report-category-progress">
                  <b>{percent}%</b>
                  <span>{recordedChecks}/{totalChecks || 0}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="report-category-grid">
        {visibleCategories.map((category) => {
          const summary = categorySummaries.find((item) => item.category.id === category.id);
          return (
            <section className={"card report-category-card tone-" + category.code.toLowerCase()} id={"report-category-" + category.code} key={category.id}>
              <div className="report-category-card-head">
                <div>
                  <div className="report-category-eyebrow">ประเภทตรวจสอบ</div>
                  <h2>{categoryLabels[category.code]}</h2>
                  <p className="muted">{category.assets.filter((asset) => asset.active).length} active / {category.assets.length} รายการ</p>
                </div>
                <div className="report-category-score">
                  <b>{summary?.percent ?? 0}%</b>
                  <span>บันทึกแล้ว</span>
                </div>
              </div>
              <div className="report-status-pills" aria-label={"รหัสสถานะ " + categoryLabels[category.code]}>
                {allowedStatusCodes(category.code).map((code) => (
                  <span className={"legend-item status-" + code} key={code}>
                    <span className="status-code">{code}</span>
                    <span className="status-label">{statusLabels[code]}</span>
                  </span>
                ))}
              </div>
              <div className="table-wrap">
                <table className="daily-table">
                  <thead>
                    <tr>
                      <th className="asset-name">รายการ</th>
                      {Array.from({ length: 31 }, (_, index) => (
                        <th key={index + 1}>{index + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {category.assets.map((asset) => (
                      <tr key={asset.id}>
                        <td className="asset-name">{asset.displayOrder}. {asset.name}</td>
                        {Array.from({ length: 31 }, (_, index) => {
                          const day = index + 1;
                          const entry = entryMap.get(asset.id + ":" + day);
                          if (day > maxDay) return <td key={day} className="muted">-</td>;
                          return (
                            <td key={day}>
                              {editable ? (
                                <StatusForm
                                  reportId={report.id}
                                  assetId={asset.id}
                                  day={day}
                                  value={entry?.statusCode}
                                  options={allowedStatusCodes(category.code)}
                                  returnTo={returnTo}
                                />
                              ) : (
                                entry?.statusCode ?? ""
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
