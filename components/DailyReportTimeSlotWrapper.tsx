"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { AssetCategoryCode, AssetStatusCode } from "@prisma/client";
import { StatusForm } from "./StatusForm";
import { BulkDayStatusForm } from "./BulkDayStatusForm";
import { getDefaultInspectionSelection, shiftDefaultSlots } from "@/lib/inspection-shifts";

const SHIFTS = [
  { value: "OFFICE_HOURS", label: "ในเวลาราชการ (08-16)" },
  { value: "MORNING_SHIFT", label: "เวรเช้า (08-16)" },
  { value: "AFTERNOON_SHIFT", label: "เวรบ่าย (16-24)" },
  { value: "NIGHT_SHIFT", label: "เวรดึก (00-08)" },
] as const;

const TIME_SLOTS = [
  { value: "SLOT_0800_0900", label: "08:00 - 09:00" },
  { value: "SLOT_0900_1000", label: "09:00 - 10:00" },
  { value: "SLOT_1100_1200", label: "11:00 - 12:00" },
  { value: "SLOT_1300_1400", label: "13:00 - 14:00" },
  { value: "SLOT_1400_1500", label: "14:00 - 15:00" },
  { value: "SLOT_1500_1600", label: "15:00 - 16:00" },
  { value: "SLOT_1600_1700", label: "16:00 - 17:00" },
  { value: "SLOT_1700_1800", label: "17:00 - 18:00" },
  { value: "SLOT_1800_1900", label: "18:00 - 19:00" },
  { value: "SLOT_1900_2000", label: "19:00 - 20:00" },
  { value: "SLOT_2000_2100", label: "20:00 - 21:00" },
  { value: "SLOT_2100_2200", label: "21:00 - 22:00" },
  { value: "SLOT_2200_2300", label: "22:00 - 23:00" },
  { value: "SLOT_2300_2400", label: "23:00 - 24:00" },
  { value: "SLOT_0000_0100", label: "00:00 - 01:00" },
  { value: "SLOT_0100_0200", label: "01:00 - 02:00" },
  { value: "SLOT_0200_0300", label: "02:00 - 03:00" },
  { value: "SLOT_0300_0400", label: "03:00 - 04:00" },
  { value: "SLOT_0400_0500", label: "04:00 - 05:00" },
  { value: "SLOT_0500_0600", label: "05:00 - 06:00" },
  { value: "SLOT_0600_0700", label: "06:00 - 07:00" },
  { value: "SLOT_0700_0800", label: "07:00 - 08:00" },
] as const;

type TimeSlotValue = (typeof TIME_SLOTS)[number]["value"];

export type EntryInfo = {
  statusCode: AssetStatusCode;
  recordedById?: string | null;
  updatedById?: string | null;
  recordedBy?: { displayName: string } | null;
  updatedBy?: { displayName: string } | null;
  updatedAt?: Date | string;
  createdAt?: Date | string;
};

const TimeSlotCtx = createContext<TimeSlotValue>("SLOT_0800_0900");

export function useSelectedTimeSlot() {
  return useContext(TimeSlotCtx);
}

export function TimeSlotSelector({ disabled }: { disabled?: boolean }) {
  return null;
}

const STATUS_COLORS: Record<string, string> = {
  N: "#16a34a",
  H: "#f59e0b",
  F: "#dc2626",
  D: "#6b7280",
  C: "#0ea5e9",
  R: "#8b5cf6",
};

function RecordedCell({ entry }: { entry: EntryInfo }) {
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
      ✓ {entry.statusCode}
    </span>
  );
}

export function DailyReportTimeSlotWrapper({
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
}: {
  reportId: string;
  categoryCode: AssetCategoryCode;
  assets: { id: string; displayOrder: number; name: string; active: boolean }[];
  visibleDays: number[];
  entryMap: Map<string, EntryInfo>;
  options: AssetStatusCode[];
  returnTo: string;
  editable: boolean;
  userId?: string;
  userRole?: string;
}) {
  const initialSelection = useMemo(() => getDefaultInspectionSelection(), []);
  const [selectedShift, setSelectedShift] = useState<string>(initialSelection.shift);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotValue>(initialSelection.timeSlot as TimeSlotValue);
  const [showOnlyUnrecorded, setShowOnlyUnrecorded] = useState(false);

  const visibleSlots = TIME_SLOTS.filter((s) => {
    const allowed = shiftDefaultSlots[selectedShift as keyof typeof shiftDefaultSlots];
    return allowed && allowed.length > 0 ? (allowed as readonly string[]).includes(s.value) : true;
  });

  const slotProgress = useMemo(() => {
    let recorded = 0;
    for (const asset of assets) {
      const entry = entryMap.get(`${asset.id}:${visibleDays[0]}:${selectedSlot}`);
      if (entry) recorded++;
    }
    return { recorded, total: assets.length };
  }, [assets, entryMap, selectedSlot, visibleDays]);

  const filteredAssets = useMemo(() => {
    if (!showOnlyUnrecorded) return assets;
    return assets.filter((asset) => {
      return visibleDays.some((day) => !entryMap.has(`${asset.id}:${day}:${selectedSlot}`));
    });
  }, [assets, entryMap, selectedSlot, visibleDays, showOnlyUnrecorded]);

  const canEditEntry = (entry: EntryInfo | undefined) => {
    if (!editable) return false;
    if (!entry) return true;
    if (userRole === "ADMIN") return true;
    return entry.recordedById === userId || entry.updatedById === userId;
  };

  return (
    <TimeSlotCtx.Provider value={selectedSlot}>
      {editable && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
            padding: "0.6rem 0",
            marginBottom: "0.5rem",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <select
            value={selectedShift}
            onChange={(e) => {
              const shift = e.target.value;
              setSelectedShift(shift);
              const defaults = shiftDefaultSlots[shift as keyof typeof shiftDefaultSlots];
              if (defaults && defaults.length > 0) {
                setSelectedSlot(defaults[0] as TimeSlotValue);
              }
            }}
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: 6,
              border: "1.5px solid #e5e7eb",
              fontSize: "0.8rem",
              background: "#f9fafb",
            }}
          >
            {SHIFTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>
            ช่วงเวลา:
          </span>
          {visibleSlots.map((slot) => {
            const active = selectedSlot === slot.value;
            return (
              <button
                key={slot.value}
                type="button"
                onClick={() => setSelectedSlot(slot.value as TimeSlotValue)}
                style={{
                  padding: "0.2rem 0.65rem",
                  borderRadius: 20,
                  border: active ? "1.5px solid #7c3aed" : "1.5px solid #e5e7eb",
                  background: active ? "#ede9fe" : "#f9fafb",
                  color: active ? "#5b21b6" : "#6b7280",
                  fontWeight: active ? 700 : 400,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {slot.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Progress indicator & filter */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", padding: "0.5rem 0", marginBottom: "0.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
            บันทึกแล้ว <strong style={{ color: "#1e293b" }}>{slotProgress.recorded}/{slotProgress.total}</strong>
          </span>
          <div style={{ width: 80, height: 6, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${slotProgress.total > 0 ? Math.round((slotProgress.recorded / slotProgress.total) * 100) : 0}%`, height: "100%", background: "linear-gradient(90deg, #3b82f6, #10b981)", borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
            {slotProgress.total > 0 ? Math.round((slotProgress.recorded / slotProgress.total) * 100) : 0}%
          </span>
        </div>
        {editable && (
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: "#475569", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showOnlyUnrecorded}
              onChange={(e) => setShowOnlyUnrecorded(e.target.checked)}
              style={{ accentColor: "#3b82f6" }}
            />
            แสดงเฉพาะรายการที่ยังไม่บันทึก
          </label>
        )}
      </div>

      <div className="table-wrap" style={{ maxHeight: "70vh", overflow: "auto" }}>
        <table className="daily-table compact-daily-table">
          <thead className="sticky-thead">
            <tr>
              <th className="asset-name">รายการ</th>
              {visibleDays.map((day) => (
                <th key={day}>{day}</th>
              ))}
            </tr>
            {editable && (
              <tr className="bulk-day-row">
                <th className="asset-name" style={{ fontSize: "0.75rem", color: "#174bd1", background: "#eaf2ff" }}>
                  บันทึกทั้งแถว
                </th>
                {visibleDays.map((day) => (
                  <th key={day} style={{ background: "#eaf2ff" }}>
                    <BulkDayStatusForm
                      reportId={reportId}
                      categoryCode={categoryCode}
                      day={day}
                      timeSlot={selectedSlot}
                      options={options}
                      returnTo={returnTo}
                    />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {filteredAssets.map((asset) => (
              <tr key={asset.id}>
                <td className="asset-name">
                  {asset.displayOrder}. {asset.name}
                </td>
                {visibleDays.map((day) => {
                  const entry = entryMap.get(`${asset.id}:${day}:${selectedSlot}`);
                  const canEdit = canEditEntry(entry);
                  return (
                    <td key={day}>
                      {entry && !canEdit ? (
                        <RecordedCell entry={entry} />
                      ) : editable && asset.active ? (
                        entry ? (
                          <StatusForm
                            reportId={reportId}
                            assetId={asset.id}
                            day={day}
                            timeSlot={selectedSlot}
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
      </div>
    </TimeSlotCtx.Provider>
  );
}
