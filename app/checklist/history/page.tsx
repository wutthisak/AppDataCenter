import { AppShell } from "@/components/AppShell";
import { ShiftStatusChart, ShiftTemperatureTrendChart } from "@/components/InspectionCharts";
import {
  inspectionShiftColors,
  inspectionShiftFullLabels,
  inspectionShiftLabels,
  inspectionShiftOrder,
  type InspectionShiftKey
} from "@/lib/inspection-shifts";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function ChecklistHistoryPage(
  props: {
    searchParams: Promise<{ dataCenterId?: string; startDate?: string; endDate?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await requireUser();
  const dataCenters = await prisma.dataCenter.findMany({
    where: { active: true },
    orderBy: { displayOrder: "asc" }
  });

  const selectedDataCenterId = searchParams.dataCenterId || dataCenters[0]?.id || "";
  const startDate = searchParams.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = searchParams.endDate || new Date().toISOString().split('T')[0];

  const inspections = await prisma.dailyInspection.findMany({
    where: {
      dataCenterId: selectedDataCenterId,
      inspectionDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    },
    orderBy: { inspectionDate: "asc" },
    include: {
      results: {
        include: {
          checklistItem: true
        }
      }
    }
  });

  const abnormalCount = inspections.reduce((sum, inspection) => {
    return sum + inspection.results.filter((r) => r.status === "ABNORMAL").length;
  }, 0);

  const totalCount = inspections.reduce((sum, inspection) => {
    return sum + inspection.results.length;
  }, 0);

  const normalCount = totalCount - abnormalCount;
  const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value));
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

  const shiftChartData = inspectionShiftOrder.map((shift) => {
    const shiftInspections = inspections.filter((inspection) => inspection.inspectionShift === shift);
    const shiftResults = shiftInspections.flatMap((inspection) => inspection.results);
    const tempValues = shiftResults
      .map((result) => toNumber(result.temperature))
      .filter((value): value is number => value !== null);
    const humidityValues = shiftResults
      .map((result) => toNumber(result.humidity))
      .filter((value): value is number => value !== null);

    return {
      shift,
      label: inspectionShiftLabels[shift],
      fullLabel: inspectionShiftFullLabels[shift],
      inspections: shiftInspections.length,
      normal: shiftResults.filter((result) => result.status === "NORMAL").length,
      abnormal: shiftResults.filter((result) => result.status === "ABNORMAL").length,
      avgTemp: average(tempValues),
      avgHumidity: average(humidityValues)
    };
  });

  const trendMap = new Map<string, { date: string } & Partial<Record<InspectionShiftKey, number>>>();
  inspections.forEach((inspection) => {
    const date = new Date(inspection.inspectionDate).toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit"
    });
    const tempValues = inspection.results
      .filter((result) => result.checklistItem.requiresTemperature)
      .map((result) => toNumber(result.temperature))
      .filter((value): value is number => value !== null);
    const avgTemp = average(tempValues);
    if (avgTemp === null) return;

    const row = trendMap.get(date) ?? { date };
    row[inspection.inspectionShift as InspectionShiftKey] = Number(avgTemp.toFixed(2));
    trendMap.set(date, row);
  });

  const temperatureTrend = Array.from(trendMap.values());
  const temperatureSeries = inspectionShiftOrder.map((shift) => ({
    key: shift,
    name: inspectionShiftLabels[shift],
    color: inspectionShiftColors[shift]
  }));

  return (
    <AppShell title="ประวัติการตรวจสอบ" subtitle="ดูประวัติและกราฟตามเวรของการตรวจสอบรายวัน">
      <div className="grid">
        <section className="card">
          <form className="toolbar" method="get">
            <div className="form-row">
              <label>
                Data Center
                <select name="dataCenterId" defaultValue={selectedDataCenterId}>
                  {dataCenters.map((dc) => (
                    <option key={dc.id} value={dc.id}>
                      {dc.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                วันที่เริ่ม
                <input type="date" name="startDate" defaultValue={startDate} />
              </label>
              <label>
                วันที่สิ้นสุด
                <input type="date" name="endDate" defaultValue={endDate} />
              </label>
              <button className="button" type="submit">
                ตั้งค่า
              </button>
            </div>
          </form>
        </section>

          <div className="grid grid-4" style={{ marginTop: "1rem" }}>
            <div className="card stat">
              <span className="muted">จำนวนการตรวจสอบ</span>
              <span className="stat-value">{inspections.length}</span>
              <span className="muted">รายการในช่วงวันที่เลือก</span>
            </div>
            <div className="card stat">
              <span className="muted">รายการทั้งหมด</span>
              <span className="stat-value">{totalCount}</span>
              <span className="muted">จากแบบตรวจรายวัน</span>
            </div>
            <div className="card stat">
              <span className="muted">ปกติ</span>
              <span className="stat-value" style={{ color: "#0f766e" }}>{normalCount}</span>
              <span className="muted">สถานะปกติ / สำเร็จ</span>
            </div>
            <div className="card stat">
              <span className="muted">พบปัญหา</span>
              <span className="stat-value" style={{ color: "var(--color-danger)" }}>{abnormalCount}</span>
              <span className="muted">สถานะผิดปกติ / ไม่สำเร็จ</span>
            </div>
          </div>

          <div className="grid grid-4" style={{ marginTop: "1rem" }}>
            {shiftChartData.map((shift) => (
              <div key={shift.shift} className="card stat" style={{ borderTop: `4px solid ${inspectionShiftColors[shift.shift]}` }}>
                <span className="muted">{shift.fullLabel}</span>
                <span className="stat-value">{shift.inspections}</span>
                <span>
                  <span className="badge">ปกติ {shift.normal}</span>{" "}
                  <span className={`badge ${shift.abnormal > 0 ? "locked" : ""}`}>ผิดปกติ {shift.abnormal}</span>
                </span>
                <span className="muted">
                  อุณหภูมิ {shift.avgTemp === null ? "-" : `${shift.avgTemp.toFixed(1)} °C`} / ความชื้น{" "}
                  {shift.avgHumidity === null ? "-" : `${shift.avgHumidity.toFixed(1)}%`}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-2" style={{ marginTop: "2rem" }}>
            <section className="card">
              <h3>สถานะการตรวจตามเวร</h3>
              <p className="muted">แสดงครบทุกเวร แม้บางเวรยังไม่มีข้อมูล</p>
              <ShiftStatusChart data={shiftChartData} />
            </section>
            <section className="card">
              <h3>แนวโน้มอุณหภูมิเฉลี่ยตามเวร</h3>
              <p className="muted">คำนวณจากหัวข้อที่บันทึกอุณหภูมิในแบบตรวจรายวัน</p>
              {temperatureTrend.length > 0 ? (
                <ShiftTemperatureTrendChart data={temperatureTrend} series={temperatureSeries} />
              ) : (
                <div className="muted" style={{ padding: "5rem 1rem", textAlign: "center", border: "1px dashed var(--line)", borderRadius: 8 }}>
                  ยังไม่มีข้อมูลอุณหภูมิในช่วงวันที่เลือก
                </div>
              )}
            </section>
          </div>

          <section className="card" style={{ marginTop: "2rem" }}>
            <div className="section-heading asset-list-heading">
              <div>
                <h3>ประวัติการตรวจสอบ</h3>
                <p className="muted">แสดงวันที่ เวร ผู้ปฏิบัติงาน และรายการผิดปกติ</p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>เวร</th>
                    <th>ผู้ปฏิบัติงาน</th>
                    <th>สถานะ</th>
                    <th>จำนวนรายการ</th>
                    <th>รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.map((inspection) => {
                    const abnormalItems = inspection.results.filter((r) => r.status === "ABNORMAL");
                    const shift = inspection.inspectionShift as InspectionShiftKey;
                    return (
                      <tr key={inspection.id}>
                        <td>
                          {new Date(inspection.inspectionDate).toLocaleDateString('th-TH', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit'
                          })}
                        </td>
                        <td>{inspectionShiftLabels[shift] ?? inspection.inspectionShift}</td>
                        <td>{inspection.inspectorName}</td>
                        <td>
                          <span className={`badge ${abnormalItems.length > 0 ? "locked" : ""}`}>
                            {abnormalItems.length > 0 ? "พบปัญหา" : "ปกติ"}
                          </span>
                        </td>
                        <td>
                          ปกติ {inspection.results.length - abnormalItems.length} / ผิดปกติ {abnormalItems.length}
                        </td>
                        <td>
                          {abnormalItems.length > 0 && (
                            <div style={{ fontSize: "0.875rem" }}>
                              {abnormalItems.map((r) => (
                                <div key={r.id}>
                                  • {r.checklistItem.name}: {r.note || "-"}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
      </div>
    </AppShell>
  );
}
