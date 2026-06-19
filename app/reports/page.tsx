import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DeleteReportButton } from "@/components/DeleteReportButton";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { thaiMonthLabel } from "@/lib/date";

type ReportSearchField = "all" | "month" | "year" | "reviewer" | "status";

function normalizeSearchField(value?: string): ReportSearchField {
  return value === "month" || value === "year" || value === "reviewer" || value === "status" ? value : "all";
}

export default async function ReportsPage(props: { searchParams?: Promise<{ q?: string; field?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  let reports = await prisma.monthlyReport.findMany({ orderBy: [{ buddhistYear: "desc" }, { month: "desc" }] });

  const q = (searchParams?.q ?? "").trim();
  const field = normalizeSearchField(searchParams?.field);
  if (q) {
    const qLower = q.toLowerCase();
    reports = reports.filter((report) => {
      const label = thaiMonthLabel(report.month, report.buddhistYear).toLowerCase();
      const reviewer = (report.reviewerName ?? "").toLowerCase();
      const status = (report.status ?? "").toLowerCase();
      const values: Record<ReportSearchField, boolean> = {
        all: label.includes(qLower) || reviewer.includes(qLower) || status.includes(qLower) || String(report.month).includes(qLower) || String(report.buddhistYear).includes(qLower),
        month: label.includes(qLower) || String(report.month).includes(qLower),
        year: String(report.buddhistYear).includes(qLower),
        reviewer: reviewer.includes(qLower),
        status: status.includes(qLower)
      };
      return values[field];
    });
  }

  return (
    <AppShell title="Monthly Operations" subtitle="สรุปผลการปฏิบัติงานประจำเดือน">
      <section className="card" style={{ marginBottom: 18 }}>
        <form className="form-row" method="get">
          <label>
            ประเภท
            <select name="field" defaultValue={field}>
              <option value="all">ทั้งหมด</option>
              <option value="month">เดือน</option>
              <option value="year">ปี พ.ศ.</option>
              <option value="reviewer">ผู้ปฏิบัติงาน</option>
              <option value="status">สถานะ</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            ค้นหารายงาน
            <input name="q" defaultValue={q} placeholder="ค้นหาตามเดือน, ปี, ผู้ปฏิบัติงาน หรือสถานะ" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button" type="submit">ค้นหา</button>
            <Link className="button secondary" href="/reports">ล้าง</Link>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>เดือน</th>
                <th>สถานะ</th>
                <th>ผู้บันทึกข้อมูล</th>
                <th>อัปเดตล่าสุด</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{thaiMonthLabel(report.month, report.buddhistYear)}</td>
                  <td>{report.status !== "DRAFT" ? <span className={`badge ${report.status === "LOCKED" ? "locked" : ""}`}>{report.status}</span> : null}</td>
                  <td>{report.reviewerName ?? "-"}</td>
                  <td>{report.updatedAt.toLocaleString("th-TH")}</td>
                  <td>
                        <div className="report-row-actions">
                          <Link className="button secondary" href={`/reports/${report.id}`}>เปิดรายงาน</Link>
                          {user.role === "ADMIN" ? <DeleteReportButton reportId={report.id} label={thaiMonthLabel(report.month, report.buddhistYear)} /> : null}
                        </div>
                      </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
