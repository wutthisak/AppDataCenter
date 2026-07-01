import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { thaiMonths } from "@/lib/date";
import { buildMonthlyReportData, formatMinutes, complianceColor } from "@/lib/monthly-report-data";
import { PrintButton, BackButton } from "./PrintButton";
import "./official.css";

export const dynamic = "force-dynamic";

function PctCell({ pct }: { pct: number }) {
  const color = complianceColor(pct);
  return (
    <div className="official-pct-bar">
      <div className="official-pct-track">
        <div className="official-pct-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="official-pct-label" style={{ color }}>{pct}%</span>
    </div>
  );
}

function SectionTitle({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <h3 className="official-section-title">
      <span className="official-section-num">{num}</span>
      {children}
    </h3>
  );
}

export default async function OfficialReportPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  await requireUser();

  const data = await buildMonthlyReportData(id);
  if (!data) notFound();

  const { month, buddhistYear, totalDays, generatedAt, executive, categoryRows,
    dataCenterRows, shiftRows, workloadRows, incidentSummary, dcRoomSummary, dcRoomDetails } = data;

  const monthName = thaiMonths[month - 1];
  const reportTitle = `รายงานสรุปผลการปฏิบัติงานประจำเดือน ${monthName} ${buddhistYear}`;
  const generatedText = generatedAt.toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric"
  });

  const SHIFT_LABELS: Record<string, string> = {
    OFFICE_HOURS: "เวลาราชการ",
    MORNING_SHIFT: "เวรเช้า (08:00–16:00)",
    AFTERNOON_SHIFT: "เวรบ่าย (16:00–24:00)",
    NIGHT_SHIFT: "เวรดึก (00:00–08:00)",
  };

  return (
    <AppShell title="Official Report" subtitle={reportTitle} hideTopbar>
      <div className="official-page">

        {/* ── Toolbar (screen only) ── */}
        <div className="official-toolbar">
          <BackButton reportId={id} />
          <PrintButton />
        </div>

        {/* ══ Document ══════════════════════════════════════════════════════ */}
        <div className="official-doc">

          {/* Document Header */}
          <header className="official-doc-header">
            <div className="official-doc-brand">
              <div className="official-doc-logo">DC</div>
              <div>
                <div className="official-doc-org">Data Center Operations System</div>
                <div className="official-doc-title">{reportTitle}</div>
                <div className="official-doc-subtitle">
                  รอบการตรวจสอบ {totalDays} วัน · เดือน {monthName} พ.ศ. {buddhistYear}
                </div>
              </div>
            </div>
            <div className="official-doc-meta">
              <strong>วันที่ออกรายงาน</strong>
              {generatedText}
              <br />
              สถานะ: เอกสารทางการ
            </div>
          </header>

          {/* ── 1. Executive Summary ── */}
          <section className="official-section">
            <SectionTitle num={1}>สรุปภาพรวมประจำเดือน (Executive Summary)</SectionTitle>

            <div className="official-kpi-grid">
              <div className="official-kpi-card">
                <div className="official-kpi-label">Data Center</div>
                <div className="official-kpi-value blue">{executive.totalDataCenters}</div>
              </div>
              <div className="official-kpi-card">
                <div className="official-kpi-label">Asset ทั้งหมด</div>
                <div className="official-kpi-value">{executive.totalAssets.toLocaleString()}</div>
              </div>
              <div className="official-kpi-card">
                <div className="official-kpi-label">รอบที่ต้องตรวจ</div>
                <div className="official-kpi-value">{executive.totalExpectedRounds.toLocaleString()}</div>
              </div>
              <div className="official-kpi-card">
                <div className="official-kpi-label">รอบที่ตรวจแล้ว</div>
                <div className="official-kpi-value blue">{executive.totalRecordedRounds.toLocaleString()}</div>
              </div>
              <div className="official-kpi-card">
                <div className="official-kpi-label">Compliance</div>
                <div className="official-kpi-value" style={{ color: complianceColor(executive.compliancePct) }}>
                  {executive.compliancePct}%
                </div>
              </div>
              <div className="official-kpi-card">
                <div className="official-kpi-label">Warning</div>
                <div className="official-kpi-value amber">{executive.warningCount.toLocaleString()}</div>
              </div>
              <div className="official-kpi-card">
                <div className="official-kpi-label">Critical</div>
                <div className="official-kpi-value red">{executive.criticalCount.toLocaleString()}</div>
              </div>
              <div className="official-kpi-card">
                <div className="official-kpi-label">ผู้ปฏิบัติงาน</div>
                <div className="official-kpi-value">{executive.activeUserCount}</div>
              </div>
            </div>

            <div className="official-kpi-grid" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
              <div className="official-kpi-card">
                <div className="official-kpi-label">รอบที่ตกค้าง</div>
                <div className="official-kpi-value" style={{ color: executive.remainingRounds > 0 ? "#dc2626" : "#059669" }}>
                  {executive.remainingRounds.toLocaleString()}
                </div>
              </div>
              <div className="official-kpi-card">
                <div className="official-kpi-label">หมวดการตรวจ (จาก Inspection Policy)</div>
                <div className="official-kpi-value">{executive.totalInspectionCategories}</div>
              </div>
            </div>
          </section>

          {/* ── 2. Category Summary ── */}
          <section className="official-section">
            <SectionTitle num={2}>ตารางสรุปผลการตรวจตามหมวด</SectionTitle>
            <div className="official-table-wrap">
              <table className="official-table">
                <thead>
                  <tr>
                    <th>หมวดการตรวจ</th>
                    <th className="center">ต้องตรวจ</th>
                    <th className="center">ตรวจแล้ว</th>
                    <th className="center">คงเหลือ</th>
                    <th className="center">Warning</th>
                    <th className="center">Critical</th>
                    <th style={{ minWidth: 120 }}>Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.map((row) => (
                    <tr key={row.key}>
                      <td style={{ fontWeight: 600 }}>{row.label}</td>
                      <td className="center">{row.expected > 0 ? row.expected.toLocaleString() : "—"}</td>
                      <td className="center">{row.expected > 0 ? row.recorded.toLocaleString() : "—"}</td>
                      <td className="center">
                        {row.remaining > 0
                          ? <span className="badge-warn">{row.remaining.toLocaleString()}</span>
                          : row.expected > 0 ? <span className="badge-ok">ครบ</span> : "—"}
                      </td>
                      <td className="center">
                        {row.warningCount > 0 ? <span className="badge-warn">{row.warningCount}</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                      <td className="center">
                        {row.criticalCount > 0 ? <span className="badge-crit">{row.criticalCount}</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                      <td>
                        {row.expected > 0 ? <PctCell pct={row.compliancePct} /> : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── 3. Data Center Summary ── */}
          {dataCenterRows.length > 0 && (
            <section className="official-section">
              <SectionTitle num={3}>ตารางสรุปตาม Data Center</SectionTitle>
              <div className="official-table-wrap">
                <table className="official-table">
                  <thead>
                    <tr>
                      <th>Data Center</th>
                      <th className="center">จำนวนรอบ</th>
                      <th className="center">ผิดปกติ</th>
                      <th style={{ minWidth: 120 }}>Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataCenterRows.map((dc) => (
                      <tr key={dc.id}>
                        <td style={{ fontWeight: 600 }}>{dc.name}</td>
                        <td className="center">{dc.rounds}</td>
                        <td className="center">
                          {dc.criticalCount > 0 ? <span className="badge-crit">{dc.criticalCount}</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                        </td>
                        <td>
                          {dc.rounds > 0 ? <PctCell pct={dc.compliancePct} /> : <span style={{ color: "#94a3b8" }}>ไม่มีข้อมูล</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── 4. Shift Summary ── */}
          <section className="official-section">
            <SectionTitle num={4}>ตารางสรุปตามเวร</SectionTitle>
            <div className="official-table-wrap">
              <table className="official-table">
                <thead>
                  <tr>
                    <th>เวร</th>
                    <th className="center">จำนวนรายการที่บันทึก</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftRows.map((s) => (
                    <tr key={s.shift}>
                      <td style={{ fontWeight: 600 }}>{SHIFT_LABELS[s.shift] ?? s.shift}</td>
                      <td className="center">{s.recorded > 0 ? s.recorded.toLocaleString() : <span style={{ color: "#94a3b8" }}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── 5. Workload ── */}
          {workloadRows.length > 0 && (
            <section className="official-section">
              <SectionTitle num={5}>Workload ผู้ดูแลระบบ</SectionTitle>
              <div className="official-table-wrap">
                <table className="official-table">
                  <thead>
                    <tr>
                      <th>ผู้ดูแลระบบ</th>
                      <th className="center">รายการ</th>
                      <th className="center">เวลารวม</th>
                      <th className="center">เฉลี่ย/รายการ</th>
                      <th>หมวดที่รับผิดชอบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workloadRows.map((w) => (
                      <tr key={w.userId}>
                        <td style={{ fontWeight: 600 }}>{w.name}</td>
                        <td className="center">{w.items.toLocaleString()}</td>
                        <td className="center">{formatMinutes(w.totalMin)}</td>
                        <td className="center">{formatMinutes(w.avgMinPerItem)}</td>
                        <td style={{ fontSize: 11, color: "#475569" }}>
                          {w.categories.length > 0 ? w.categories.join(", ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── 6. Incident Summary ── */}
          <section className="official-section">
            <SectionTitle num={6}>สรุปรายการผิดปกติ (Incident Summary)</SectionTitle>
            {incidentSummary.total === 0 ? (
              <p style={{ color: "#059669", fontSize: 13, fontWeight: 600 }}>✓ ไม่พบรายการผิดปกติในเดือนนี้</p>
            ) : (
              <div className="official-table-wrap">
                <table className="official-table">
                  <thead>
                    <tr>
                      <th>ระดับ</th>
                      <th className="center">วันที่</th>
                      <th>ทรัพย์สิน / อุปกรณ์</th>
                      <th>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidentSummary.warningItems.map((item, i) => (
                      <tr key={`w-${i}`}>
                        <td><span className="badge-warn">Warning</span></td>
                        <td className="center">วันที่ {item.day}</td>
                        <td>{item.assetName}</td>
                        <td style={{ color: "#64748b", fontSize: 11 }}>{item.note ?? "—"}</td>
                      </tr>
                    ))}
                    {incidentSummary.criticalItems.map((item, i) => (
                      <tr key={`c-${i}`}>
                        <td><span className="badge-crit">Critical</span></td>
                        <td className="center">วันที่ {item.day}</td>
                        <td>{item.assetName}</td>
                        <td style={{ color: "#64748b", fontSize: 11 }}>{item.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── 7. DC Room Summary ── */}
          <section className="official-section">
            <SectionTitle num={7}>สรุปผลการตรวจห้อง Data Center (แยกรายห้อง)</SectionTitle>

            {/* Overall row */}
            <div className="official-kpi-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 14 }}>
              <div className="official-kpi-card">
                <div className="official-kpi-label">รอบตรวจรวม</div>
                <div className="official-kpi-value blue">{dcRoomSummary.totalRounds}</div>
              </div>
              <div className="official-kpi-card">
                <div className="official-kpi-label">อุณหภูมิเฉลี่ย (รวม)</div>
                <div className="official-kpi-value">
                  {dcRoomSummary.avgTemperature !== null ? `${dcRoomSummary.avgTemperature}°C` : "—"}
                </div>
              </div>
              <div className="official-kpi-card">
                <div className="official-kpi-label">ความชื้นเฉลี่ย (รวม)</div>
                <div className="official-kpi-value">
                  {dcRoomSummary.avgHumidity !== null ? `${dcRoomSummary.avgHumidity}%` : "—"}
                </div>
              </div>
              <div className="official-kpi-card">
                <div className="official-kpi-label">รายการผิดปกติ (รวม)</div>
                <div className="official-kpi-value red">{dcRoomSummary.abnormalCount.toLocaleString()}</div>
              </div>
            </div>

            {/* Per-DC breakdown table */}
            {dcRoomDetails.length > 0 && (
              <div className="official-table-wrap">
                <table className="official-table">
                  <thead>
                    <tr>
                      <th>ห้อง Data Center</th>
                      <th className="center">รอบตรวจ</th>
                      <th className="center">อุณหภูมิเฉลี่ย</th>
                      <th className="center">ความชื้นเฉลี่ย</th>
                      <th className="center">รายการผิดปกติ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dcRoomDetails.map((dc) => (
                      <tr key={dc.id}>
                        <td style={{ fontWeight: 600 }}>{dc.name}</td>
                        <td className="center">{dc.rounds > 0 ? dc.rounds : <span style={{ color: "#94a3b8" }}>—</span>}</td>
                        <td className="center">
                          {dc.avgTemperature !== null ? `${dc.avgTemperature}°C` : <span style={{ color: "#94a3b8" }}>—</span>}
                        </td>
                        <td className="center">
                          {dc.avgHumidity !== null ? `${dc.avgHumidity}%` : <span style={{ color: "#94a3b8" }}>—</span>}
                        </td>
                        <td className="center">
                          {dc.abnormalCount > 0
                            ? <span className="badge-crit">{dc.abnormalCount}</span>
                            : dc.rounds > 0 ? <span className="badge-ok">ปกติ</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── 9. Remarks ── */}
          <section className="official-section">
            <SectionTitle num={8}>ข้อเสนอแนะและสรุปผลการปฏิบัติงาน</SectionTitle>
            <span className="official-remarks-label">สรุปผลและข้อสังเกตของเดือน {monthName} {buddhistYear}</span>
            <div className="official-remarks">
              {executive.compliancePct >= 90 && (
                <div>• ภาพรวมการปฏิบัติงานผ่านเกณฑ์ที่กำหนด (Compliance {executive.compliancePct}%)</div>
              )}
              {executive.compliancePct < 90 && (
                <div>• ภาพรวม Compliance อยู่ที่ {executive.compliancePct}% ต่ำกว่าเกณฑ์ที่กำหนด (90%) ควรดำเนินการปรับปรุง</div>
              )}
              {executive.remainingRounds > 0 && (
                <div>• มีรอบตรวจตกค้าง {executive.remainingRounds.toLocaleString()} รอบ ควรดำเนินการบันทึกให้ครบถ้วน</div>
              )}
              {executive.warningCount > 0 && (
                <div>• พบ Warning {executive.warningCount} รายการ ควรติดตามและแก้ไขตามความเหมาะสม</div>
              )}
              {executive.criticalCount > 0 && (
                <div>• พบ Critical {executive.criticalCount} รายการ ต้องดำเนินการแก้ไขโดยเร่งด่วน</div>
              )}
              {executive.warningCount === 0 && executive.criticalCount === 0 && (
                <div>• ไม่พบรายการผิดปกติในเดือนนี้</div>
              )}
              <div style={{ marginTop: 12, color: "#94a3b8", fontSize: 11 }}>
                (พื้นที่สำหรับเพิ่มข้อเสนอแนะเพิ่มเติม)
              </div>
            </div>
          </section>

          {/* ── 10. Signatures ── */}
          <section className="official-section">
            <SectionTitle num={9}>ลงนามรับรอง</SectionTitle>
            <div className="official-sig-row">
              {[
                { title: "ผู้จัดทำรายงาน", role: "Preparer" },
                { title: "ผู้ตรวจสอบ", role: "Reviewer" },
                { title: "ผู้รับรอง / ผู้บริหาร", role: "Approver" },
              ].map((sig) => (
                <div key={sig.role} className="official-sig-item">
                  <div className="official-sig-badge">{sig.role}</div>
                  <div className="official-sig-title">{sig.title}</div>
                  <div className="official-sig-stamp-area" />
                  <div className="official-sig-field-row">
                    <span className="official-sig-field-label">ลงชื่อ</span>
                    <span className="official-sig-dotline" />
                  </div>
                  <div className="official-sig-field-row">
                    <span className="official-sig-field-label">ตำแหน่ง</span>
                    <span className="official-sig-dotline" />
                  </div>
                  <div className="official-sig-field-row">
                    <span className="official-sig-field-label">วันที่</span>
                    <span className="official-sig-dotline" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Doc footer */}
          <div style={{
            marginTop: 32, paddingTop: 12, borderTop: "1px solid #e2e8f0",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: 10, color: "#94a3b8"
          }}>
            <span>Data Center Operations System — รายงานสร้างโดยระบบอัตโนมัติ</span>
            <span>ออกรายงาน: {generatedText}</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
