"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AssetCategoryCode, AssetStatusCode } from "@prisma/client";
import { StatusForm } from "./StatusForm";
import { BulkDayStatusForm } from "./BulkDayStatusForm";
import RefreshButton from "./RefreshButton";
import { SaveAllStatusesModal } from "./SaveAllStatusesModal";
import { ResetModal } from "./ResetModal";
import { Toast } from "./Toast";
import { statusLabels } from "@/lib/constants";
import { Filter, MoreHorizontal, RefreshCw } from "lucide-react";
import {
  getDefaultInspectionSelection,
  inspectionTimeSlotLabels,
  shiftDefaultSlots,
} from "@/lib/inspection-shifts";
import type { InspectionShiftKey, InspectionTimeSlotKey } from "@/lib/inspection-shifts";

const DURATION_OPTIONS = [5, 10, 15, 30, 45, 60] as const;
type DurationMinutes = typeof DURATION_OPTIONS[number];

const SLOT_START_TIMES: Record<string, string> = {
  SLOT_0800_0900: "08:00", SLOT_0900_1000: "09:00", SLOT_1100_1200: "11:00",
  SLOT_1300_1400: "13:00", SLOT_1400_1500: "14:00", SLOT_1500_1600: "15:00",
  SLOT_1600_1700: "16:00", SLOT_1700_1800: "17:00", SLOT_1800_1900: "18:00",
  SLOT_1900_2000: "19:00", SLOT_2000_2100: "20:00", SLOT_2100_2200: "21:00",
  SLOT_2200_2300: "22:00", SLOT_2300_2400: "23:00", SLOT_0000_0100: "00:00",
  SLOT_0100_0200: "01:00", SLOT_0200_0300: "02:00", SLOT_0300_0400: "03:00",
  SLOT_0400_0500: "04:00", SLOT_0500_0600: "05:00", SLOT_0600_0700: "06:00",
  SLOT_0700_0800: "07:00",
};

function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const rh = Math.floor(total / 60) % 24;
  const rm = total % 60;
  return `${String(rh).padStart(2, "0")}:${String(rm).padStart(2, "0")}`;
}

const SHIFTS: { value: InspectionShiftKey; label: string }[] = [
  { value: "OFFICE_HOURS", label: "ในเวลาราชการ 08:00-16:00" },
  { value: "MORNING_SHIFT", label: "เวรเช้า 08:00-16:00" },
  { value: "AFTERNOON_SHIFT", label: "เวรบ่าย 16:00-24:00" },
  { value: "NIGHT_SHIFT", label: "เวรดึก 00:00-08:00" },
];

function formatInspectedAt(buddhistYear: number, month: number, day: number) {
  const now = new Date();
  const date = new Date(buddhistYear - 543, month - 1, day, now.getHours(), now.getMinutes());
  const yr = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yr}-${mm}-${dd}T${hh}:${min}`;
}

const STATUS_COLORS: Record<string, string> = {
  N: "#16a34a",
  H: "#f59e0b",
  F: "#dc2626",
  D: "#6b7280",
  C: "#0ea5e9",
  R: "#8b5cf6",
};

export type MonthlyEntryInfo = {
  statusCode: AssetStatusCode;
  recordedById?: string | null;
  updatedById?: string | null;
  recordedBy?: { displayName: string } | null;
  updatedBy?: { displayName: string } | null;
  updatedAt?: Date | string;
  createdAt?: Date | string;
};

function RecordedCell({ entry }: { entry: MonthlyEntryInfo }) {
  const color = STATUS_COLORS[entry.statusCode] ?? "#374151";
  const recorder = entry.updatedBy?.displayName ?? entry.recordedBy?.displayName ?? "—";
  const dateStr = entry.updatedAt
    ? new Date(entry.updatedAt).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <span
      title={`ผู้บันทึก: ${recorder}\nเวลา: ${dateStr}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontWeight: 700,
        fontSize: "0.8rem",
        color,
        cursor: "default",
      }}
    >
      {entry.statusCode}
    </span>
  );
}

export function MonthlyReportView({
  reportId,
  categoryCode,
  assets,
  visibleDays,
  entryMap,
  options,
  returnTo,
  editable,
  userId,
  userRole,
  month,
  buddhistYear,
  maxDay,
  range,
  firstRangeHref,
  secondRangeHref,
}: {
  reportId: string;
  categoryCode: AssetCategoryCode;
  assets: { id: string; displayOrder: number; name: string; active: boolean }[];
  visibleDays: number[];
  entryMap: Map<string, MonthlyEntryInfo>;
  options: AssetStatusCode[];
  returnTo: string;
  editable: boolean;
  userId?: string;
  userRole?: string;
  month: number;
  buddhistYear: number;
  maxDay: number;
  range: 1 | 2;
  firstRangeHref: string;
  secondRangeHref: string;
}) {
  const [showOnlyUnrecorded, setShowOnlyUnrecorded] = useState(false);
  const [filterMode, setFilterMode] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const defaultSel = useMemo(() => getDefaultInspectionSelection(), []);
  const [selectedShift, setSelectedShift] = useState<InspectionShiftKey>(defaultSel.shift);
  const [selectedSlot, setSelectedSlot] = useState<InspectionTimeSlotKey>(defaultSel.timeSlot);
  const [selectedDuration, setSelectedDuration] = useState<DurationMinutes>(15);
  const getInspectedAt = () => formatInspectedAt(buddhistYear, month, new Date().getDate());

  const visibleSlots = useMemo(() => shiftDefaultSlots[selectedShift] ?? [], [selectedShift]);
  const slotStart = SLOT_START_TIMES[selectedSlot] ?? "08:00";
  const slotEnd = addMinutesToTime(slotStart, selectedDuration);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem("monthly-ops-saved");
    if (saved === "1") {
      setToastMessage("บันทึกข้อมูลสำเร็จ");
      window.sessionStorage.removeItem("monthly-ops-saved");
    }
  }, []);

  const isCurrentReportMonth = useMemo(() => {
    const today = new Date();
    return month === today.getMonth() + 1 && buddhistYear === today.getFullYear() + 543;
  }, [month, buddhistYear]);

  const currentDay = useMemo(() => {
    if (!isCurrentReportMonth) return null;
    return new Date().getDate();
  }, [isCurrentReportMonth]);

  const dayMetaMap = useMemo(() => {
    const gregorianYear = buddhistYear - 543;
    const map = new Map<number, { weekend: boolean; current: boolean }>();
    for (const day of visibleDays) {
      const weekday = new Date(gregorianYear, month - 1, day).getDay();
      map.set(day, {
        weekend: weekday === 0 || weekday === 6,
        current: currentDay === day,
      });
    }
    return map;
  }, [buddhistYear, currentDay, month, visibleDays]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (showOnlyUnrecorded && !visibleDays.some((day) => !entryMap.has(`${asset.id}:${day}`))) return false;

      if (filterMode === "all") return true;

      return visibleDays.some((day) => entryMap.get(`${asset.id}:${day}`)?.statusCode === filterMode);
    });
  }, [assets, entryMap, filterMode, showOnlyUnrecorded, visibleDays]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, showOnlyUnrecorded, range, month, buddhistYear]);

  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAssets = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, safePage]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (safePage <= 4) return [1, 2, 3, 4, 5, -1, totalPages];
    if (safePage >= totalPages - 3) return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, -1, safePage - 1, safePage, safePage + 1, -1, totalPages];
  }, [safePage, totalPages]);

  const canEditEntry = (entry: MonthlyEntryInfo | undefined) => {
    if (!editable) return false;
    if (!entry) return true;
    if (userRole === "ADMIN") return true;
    return entry.recordedById === userId || entry.updatedById === userId;
  };

  const handleExportCsv = () => {
    const csvRows = [
      ["รายการ", ...visibleDays.map((day) => String(day))],
      ...filteredAssets.map((asset) => [
        `${asset.displayOrder}. ${asset.name}`,
        ...visibleDays.map((day) => entryMap.get(`${asset.id}:${day}`)?.statusCode ?? ""),
      ]),
    ];

    const csv = csvRows
      .map((row) => row.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `monthly-operations-${month}-${buddhistYear}-range-${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleStatusChangeCapture = (event: React.FormEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.name !== "statusCode") return;
    if (!target.value) return;
    setHasUnsavedChanges(true);
  };

  const handleStatusSubmitCapture = (event: React.FormEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement)) return;
    const hasStatusField = target.querySelector("select[name='statusCode'], input[name='statusCode']");
    if (!hasStatusField) return;
    setHasUnsavedChanges(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("monthly-ops-saved", "1");
    }
  };

  return (
    <div className="monthly-ops-layout">

      {/* ── Inspection Control Panel ── */}
      {editable && (
        <div style={{
          background: "linear-gradient(135deg, #f0f7ff 0%, #f5f3ff 100%)",
          border: "1px solid #bfdbfe", borderRadius: 16, padding: "16px 20px", marginBottom: 4,
          boxShadow: "0 2px 12px rgba(37,99,235,0.06)",
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>⏱ กำหนดเวลาตรวจสอบ</div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1.4fr) minmax(0,1.4fr) minmax(0,1fr)", gap: 10 }}>

            <div className="daily-recording-field-card" style={{ background: "#fff", borderColor: "#bfdbfe", minWidth: 0 }}>
              <div className="daily-recording-label">เวรที่บันทึก</div>
              <select value={selectedShift} onChange={(e) => {
                const shift = e.target.value as InspectionShiftKey;
                setSelectedShift(shift);
                const defaults = shiftDefaultSlots[shift];
                if (defaults && defaults.length > 0) setSelectedSlot(defaults[0]);
              }}>
                {SHIFTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div className="daily-recording-field-card" style={{ background: "#fff", borderColor: "#bfdbfe", minWidth: 0 }}>
              <div className="daily-recording-label">ช่วงเวลาตรวจสอบ</div>
              <select value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value as InspectionTimeSlotKey)}>
                {visibleSlots.map((slot) => <option key={slot} value={slot}>{inspectionTimeSlotLabels[slot]}</option>)}
              </select>
            </div>

            <div className="daily-recording-field-card" style={{ background: "#fff", borderColor: "#c4b5fd", minWidth: 0 }}>
              <div className="daily-recording-label" style={{ color: "#7c3aed" }}>ระยะเวลาที่ใช้ตรวจสอบ</div>
              <select value={selectedDuration} onChange={(e) => setSelectedDuration(Number(e.target.value) as DurationMinutes)}>
                {DURATION_OPTIONS.map((m) => <option key={m} value={m}>{m} นาที</option>)}
              </select>
            </div>

            <div style={{
              padding: "10px 12px", borderRadius: 12,
              background: "linear-gradient(135deg, #eff6ff, #f5f3ff)",
              border: "1px solid #c4b5fd", minWidth: 0,
              display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.05em" }}>เวลาตรวจ</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#4f46e5", whiteSpace: "nowrap" }}>{slotStart}–{slotEnd}</div>
              <div style={{ fontSize: 11, color: "#7c3aed" }}>{selectedDuration} นาที</div>
            </div>

          </div>
        </div>
      )}

      <div className="monthly-ops-toolbar">
        <div className="monthly-toolbar-group monthly-toolbar-group--range">
          <div className="monthly-title-block">
            <h3>ภาพรวมสถานะรายเดือน</h3>
            <span>เดือน {month} / {buddhistYear}</span>
          </div>
          <Link className={`monthly-pill-button monthly-pill-button--secondary ${range === 1 ? "is-active" : ""}`} href={firstRangeHref}>
            วันที่ 1-15
          </Link>
          <Link className={`monthly-pill-button monthly-pill-button--secondary ${range === 2 ? "is-active" : ""}`} href={secondRangeHref}>
            วันที่ 16-{maxDay}
          </Link>
          <RefreshButton className="monthly-pill-button monthly-pill-button--secondary" href={returnTo}>
            <RefreshCw size={15} />
            Refresh
          </RefreshButton>
          {editable && (
            <>
              <SaveAllStatusesModal
                reportId={reportId}
                categoryCode={categoryCode}
                options={options}
                maxDay={maxDay}
                returnTo={returnTo}
              />
              <ResetModal
                reportId={reportId}
                categoryCode={categoryCode}
                maxDay={maxDay}
                returnTo={returnTo}
              />
            </>
          )}
        </div>

        <div className="monthly-toolbar-group monthly-toolbar-group--tools">
          <label className="monthly-toolbar-filter" aria-label="ตัวกรองข้อมูล">
            <Filter size={15} />
            <select value={filterMode} onChange={(event) => setFilterMode(event.target.value)}>
              <option value="all">ทั้งหมด</option>
              {options.map((status) => (
                <option key={status} value={status}>
                  {status} - {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="monthly-pill-button monthly-pill-button--secondary" onClick={handleExportCsv}>
            <MoreHorizontal size={15} />
            More
          </button>
        </div>
      </div>

      <div className="monthly-legend-card">
        <div className="monthly-legend-row">
          {options.map((status) => (
            <div key={status} className={`monthly-legend-item monthly-status-${status}`}>
              <span className="monthly-legend-badge">{status}</span>
              <span className="monthly-legend-label">{statusLabels[status]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="monthly-grid-header">
        <label className="monthly-unrecorded-checkbox">
          <input
            type="checkbox"
            checked={showOnlyUnrecorded}
            onChange={(event) => setShowOnlyUnrecorded(event.target.checked)}
          />
          แสดงเฉพาะรายการที่ยังไม่บันทึก
        </label>
        {hasUnsavedChanges && <p className="monthly-unsaved-indicator">● Unsaved Changes</p>}
      </div>

      <div className="table-wrap monthly-ops-grid" onChangeCapture={handleStatusChangeCapture} onSubmitCapture={handleStatusSubmitCapture}>
        <table className="daily-table compact-daily-table monthly-ops-table">
          <thead className="monthly-ops-thead">
            <tr>
              <th className="asset-name monthly-asset-name">รายการ</th>
              {visibleDays.map((day) => (
                <th
                  key={day}
                  className={[
                    dayMetaMap.get(day)?.weekend ? "is-weekend" : "",
                    dayMetaMap.get(day)?.current ? "is-current-day" : "",
                    hoveredDay === day ? "is-hover-column" : "",
                  ].filter(Boolean).join(" ")}
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {day}
                </th>
              ))}
            </tr>
            {editable && (
              <tr className="bulk-day-row">
                <th className="asset-name monthly-asset-name monthly-bulk-head">
                  บันทึกทั้งแถว
                </th>
                {visibleDays.map((day) => (
                  <th
                    key={day}
                    className={[
                      "monthly-bulk-cell",
                      dayMetaMap.get(day)?.weekend ? "is-weekend" : "",
                      dayMetaMap.get(day)?.current ? "is-current-day" : "",
                      hoveredDay === day ? "is-hover-column" : "",
                    ].filter(Boolean).join(" ")}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    <BulkDayStatusForm
                      reportId={reportId}
                      categoryCode={categoryCode}
                      day={day}
                      timeSlot={selectedSlot}
                      inspectionShift={selectedShift}
                      durationMinutes={selectedDuration}
                      inspectedAt={getInspectedAt()}
                      options={options}
                      returnTo={returnTo}
                    />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {paginatedAssets.map((asset) => (
              <tr key={asset.id}>
                <td className="asset-name">
                  {asset.displayOrder}. {asset.name}
                </td>
                {visibleDays.map((day) => {
                  const entry = entryMap.get(`${asset.id}:${day}`);
                  const canEdit = canEditEntry(entry);
                  return (
                    <td
                      key={day}
                      className={[
                        dayMetaMap.get(day)?.weekend ? "is-weekend" : "",
                        dayMetaMap.get(day)?.current ? "is-current-day" : "",
                        hoveredDay === day ? "is-hover-column" : "",
                      ].filter(Boolean).join(" ")}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      {entry && !canEdit ? (
                        <RecordedCell entry={entry} />
                      ) : editable && asset.active ? (
                        entry ? (
                          <StatusForm
                            reportId={reportId}
                            assetId={asset.id}
                            day={day}
                            timeSlot={selectedSlot}
                            inspectionShift={selectedShift}
                            durationMinutes={selectedDuration}
                            inspectedAt={getInspectedAt()}
                            value={entry.statusCode}
                            options={options}
                            returnTo={returnTo}
                          />
                        ) : (
                          <StatusForm
                            reportId={reportId}
                            assetId={asset.id}
                            day={day}
                            timeSlot={selectedSlot}
                            inspectionShift={selectedShift}
                            durationMinutes={selectedDuration}
                            inspectedAt={getInspectedAt()}
                            value={undefined}
                            options={options}
                            returnTo={returnTo}
                          />
                        )
                      ) : entry ? (
                        <RecordedCell entry={entry} />
                      ) : (
                        <span style={{ color: "#d1d5db" }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="monthly-pagination">
          <p className="monthly-grid-summary">แสดง {paginatedAssets.length} จาก {filteredAssets.length} รายการ</p>
          <div className="monthly-pagination-actions" aria-label="pagination">
            {pageNumbers.map((page, index) => (
              page === -1 ? (
                <span key={`gap-${index}`} className="monthly-page-gap">...</span>
              ) : (
                <button
                  key={page}
                  type="button"
                  className={`monthly-page-button ${safePage === page ? "is-active" : ""}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              )
            ))}
          </div>
        </div>
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage}
          variant="success"
          onClose={() => setToastMessage("")}
        />
      )}
    </div>
  );
}
