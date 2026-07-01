"use client";
// @ts-nocheck

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
type AssetCategoryCode = "VM" | "SERVER" | "NETWORK" | "STORAGE" | "BACKUP";
type AssetStatusCode = "N" | "H" | "F" | "D" | "C" | "R";
type DailyAsset = {
  id: string;
  displayOrder: number;
  name: string;
  active?: boolean;
  deviceType?: string | null;
  ownershipType?: string | null;
  brand?: string | null;
  model?: string | null;
  ipAddress?: string | null;
  location?: string | null;
  disk?: string | null;
  assetNumber?: string | null;
  installedAt?: string | Date | null;
};
import { upsertStatusActionClient, bulkUpsertStatusAction } from "@/app/actions";
import { statusLabels } from "@/lib/constants";
import {
  getDefaultInspectionSelection,
  inspectionTimeSlotLabels,
  isInspectionTimeSlotKey,
  shiftDefaultSlots
} from "@/lib/inspection-shifts";
import type { InspectionShiftKey, InspectionTimeSlotKey } from "@/lib/inspection-shifts";

// ─── Duration options ──────────────────────────────────────────────────────
const DURATION_OPTIONS = [5, 10, 15, 30, 45, 60] as const;
type DurationMinutes = typeof DURATION_OPTIONS[number];

// ─── Slot start times ──────────────────────────────────────────────────────
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

// ─── Toast system ──────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "warning" | "info";
type ToastItem = { id: string; type: ToastType; title: string; message?: string };

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✓", error: "✕", warning: "⚠", info: "ℹ",
};
const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string; title: string }> = {
  success: { bg: "#f0fdf4", border: "#86efac", icon: "#16a34a", title: "#15803d" },
  error:   { bg: "#fff1f2", border: "#fca5a5", icon: "#dc2626", title: "#b91c1c" },
  warning: { bg: "#fffbeb", border: "#fcd34d", icon: "#d97706", title: "#b45309" },
  info:    { bg: "#eff6ff", border: "#93c5fd", icon: "#2563eb", title: "#1d4ed8" },
};

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none",
      maxWidth: 360,
    }}>
      {toasts.map((t) => {
        const c = TOAST_COLORS[t.type];
        return (
          <div key={t.id} style={{
            pointerEvents: "auto",
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: 14, padding: "14px 16px",
            boxShadow: "0 8px 32px rgba(15,23,42,0.14)",
            display: "flex", alignItems: "flex-start", gap: 12,
            animation: "slideInRight 0.22s ease",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: c.icon, color: "#fff",
              display: "grid", placeItems: "center", fontSize: 16, fontWeight: 900,
            }}>{TOAST_ICONS[t.type]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: c.title, fontSize: 14 }}>{t.title}</div>
              {t.message && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{t.message}</div>}
            </div>
            <button onClick={() => onDismiss(t.id)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#94a3b8", fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0,
            }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);
  const dismiss = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  return { toasts, push, dismiss };
}

const STATUS_COLORS: Record<string, string> = {
  N: "#16a34a",
  H: "#f59e0b",
  F: "#dc2626",
  D: "#6b7280",
  C: "#0ea5e9",
  R: "#8b5cf6",
};

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string; soft: string }> = {
  N: { color: "#15803d", bg: "#dcfce7", border: "#86efac", soft: "#f0fdf4" },
  H: { color: "#b45309", bg: "#fef3c7", border: "#fcd34d", soft: "#fffbeb" },
  F: { color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5", soft: "#fff1f2" },
  D: { color: "#475569", bg: "#e2e8f0", border: "#cbd5e1", soft: "#f8fafc" },
  C: { color: "#0369a1", bg: "#e0f2fe", border: "#7dd3fc", soft: "#f0f9ff" },
  R: { color: "#6d28d9", bg: "#ede9fe", border: "#c4b5fd", soft: "#faf5ff" },
};

const statusStyle = (code: string) =>
  STATUS_STYLES[code] ?? { color: "#374151", bg: "#f3f4f6", border: "#d1d5db", soft: "#f9fafb" };

const SHIFTS: { value: InspectionShiftKey; label: string }[] = [
  { value: "OFFICE_HOURS", label: "ในเวลาราชการ 08:00-16:00" },
  { value: "MORNING_SHIFT", label: "เวรเช้า 08:00-16:00" },
  { value: "AFTERNOON_SHIFT", label: "เวรบ่าย 16:00-24:00" },
  { value: "NIGHT_SHIFT", label: "เวรดึก 00:00-08:00" },
];

export type DailyEntry = {
  id: string;
  assetId: string;
  statusCode: AssetStatusCode;
  timeSlot: string;
  note?: string | null;
  recordedById?: string | null;
  updatedById?: string | null;
  recordedBy?: { displayName: string } | null;
  updatedBy?: { displayName: string } | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

function getLatestEntryTimeSlot(entries: DailyEntry[]) {
  const latest = entries
    .filter((entry) => isInspectionTimeSlotKey(entry.timeSlot))
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    })[0];

  return latest?.timeSlot;
}

function formatInspectedAt(month: number, buddhistYear: number, day: number) {
  const now = new Date();
  const date = new Date(buddhistYear - 543, month - 1, day, now.getHours(), now.getMinutes());
  const year = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${mm}-${dd}T${hh}:${min}`;
}

export function DailyRecordingView({
  reportId,
  categoryCode,
  assets,
  day,
  month,
  buddhistYear,
  entries,
  options,
  returnTo,
  editable,
  userId,
  userRole,
}: {
  reportId: string;
  categoryCode: AssetCategoryCode;
  assets: DailyAsset[];
  day: number;
  month: number;
  buddhistYear: number;
  entries: DailyEntry[];
  options: AssetStatusCode[];
  returnTo: string;
  editable: boolean;
  userId?: string;
  userRole?: string;
}) {
  const router = useRouter();
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const preferredSelection = useMemo(
    () => getDefaultInspectionSelection(getLatestEntryTimeSlot(entries)),
    [entries]
  );
  const [selectedShift, setSelectedShift] = useState<InspectionShiftKey>(preferredSelection.shift);
  const [selectedSlot, setSelectedSlot] = useState<InspectionTimeSlotKey>(preferredSelection.timeSlot);
  const [selectedDuration, setSelectedDuration] = useState<DurationMinutes>(15);
  const [showOnlyUnrecorded, setShowOnlyUnrecorded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<AssetStatusCode | "">("");
  const getInspectedAt = () => formatInspectedAt(month, buddhistYear, day);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [pendingStatusConfirm, setPendingStatusConfirm] = useState<{
    mode: "single" | "bulk" | "edit";
    assetId?: string;
    statusCode: AssetStatusCode;
    assetName: string;
    count?: number;
    assetIds?: string[];
  } | null>(null);

  const slotStart = SLOT_START_TIMES[selectedSlot] ?? "08:00";
  const slotEnd = addMinutesToTime(slotStart, selectedDuration);

  useEffect(() => {
    setSelectedShift(preferredSelection.shift);
    setSelectedSlot(preferredSelection.timeSlot);
    setSelectedIds(new Set());
    setBulkStatus("");
  }, [day, month, buddhistYear, preferredSelection.shift, preferredSelection.timeSlot]);

  // Map assetId -> entry
  const entryMap = useMemo(() => {
    const map = new Map<string, DailyEntry>();
    for (const e of entries) map.set(e.assetId, e);
    return map;
  }, [entries]);

  const recordedCount = entries.length;
  const totalCount = assets.length;
  const remainingCount = totalCount - recordedCount;
  const coveragePct = totalCount > 0 ? Math.round((recordedCount / totalCount) * 100) : 0;

  // Visible time slots for selected shift
  const visibleSlots = useMemo(() => {
    const allowed = shiftDefaultSlots[selectedShift];
    return allowed || [];
  }, [selectedShift]);

  // Filter assets
  const filteredAssets = useMemo(() => {
    if (!showOnlyUnrecorded) return assets;
    return assets.filter((a) => !entryMap.has(a.id));
  }, [assets, entryMap, showOnlyUnrecorded]);

  const canEditEntry = (entry: DailyEntry | undefined) => {
    if (!editable) return false;
    if (!entry) return true;
    if (userRole === "ADMIN") return true;
    return entry.recordedById === userId || entry.updatedById === userId;
  };

  const toggleSelect = (assetId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const selectAllVisible = () => {
    const unrecordedVisible = filteredAssets.filter((a) => !entryMap.has(a.id));
    setSelectedIds(new Set(unrecordedVisible.map((a) => a.id)));
  };

  const deselectAll = () => setSelectedIds(new Set());

  const allVisibleSelected = useMemo(() => {
    const unrecordedVisible = filteredAssets.filter((a) => !entryMap.has(a.id));
    if (unrecordedVisible.length === 0) return false;
    return unrecordedVisible.every((a) => selectedIds.has(a.id));
  }, [filteredAssets, entryMap, selectedIds]);

  // Bulk save selected
  const handleBulkSave = async (statusCode = bulkStatus, assetIds = Array.from(selectedIds)) => {
    if (!statusCode || assetIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("reportId", reportId);
      formData.append("categoryCode", categoryCode);
      formData.append("day", String(day));
      formData.append("statusCode", statusCode);
      formData.append("returnTo", returnTo);
      formData.append("timeSlots", selectedSlot);
      formData.append("inspectionShift", selectedShift);
      formData.append("inspectedAt", getInspectedAt());
      formData.append("durationMinutes", String(selectedDuration));
      for (const id of assetIds) formData.append("assetIds", id);
      await bulkUpsertStatusAction(formData);
      pushToast("success", "บันทึกสำเร็จ", `บันทึก ${assetIds.length} รายการ · ${slotStart}–${slotEnd} (${selectedDuration} นาที)`);
    } catch (err: any) {
      if (err?.digest?.startsWith("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") throw err;
      console.error(err);
      pushToast("error", "บันทึกไม่สำเร็จ", "เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
    setIsSubmitting(false);
    setSelectedIds(new Set());
    setBulkStatus("");
    router.refresh();
  };

  // Single row save
  const handleSingleSave = async (assetId: string, statusCode: string) => {
    try {
      const formData = new FormData();
      formData.append("reportId", reportId);
      formData.append("assetId", assetId);
      formData.append("day", String(day));
      formData.append("statusCode", statusCode);
      formData.append("timeSlot", selectedSlot);
      formData.append("inspectionShift", selectedShift);
      formData.append("inspectedAt", getInspectedAt());
      formData.append("durationMinutes", String(selectedDuration));
      formData.append("returnTo", returnTo);
      const result = await upsertStatusActionClient(formData);
      if (!result.ok) {
        pushToast("error", "บันทึกไม่สำเร็จ", result.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
        return;
      }
      pushToast("success", "บันทึกสำเร็จ", `${slotStart}–${slotEnd} (${selectedDuration} นาที)`);
      if (result.redirectTo) { router.push(result.redirectTo); return; }
    } catch (err) {
      console.error(err);
      pushToast("error", "บันทึกไม่สำเร็จ", "เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
    router.refresh();
  };

  const requestBulkConfirm = () => {
    if (selectedIds.size === 0) {
      pushToast("info", "กรุณาเลือกรายการ", "ยังไม่ได้เลือกรายการที่ต้องการบันทึก");
      return;
    }
    if (!bulkStatus) {
      pushToast("warning", "กรุณาเลือกสถานะ", "ต้องเลือกสถานะก่อนบันทึก");
      return;
    }
    setPendingStatusConfirm({
      mode: "bulk",
      statusCode: bulkStatus,
      assetName: "รายการที่เลือก",
      count: selectedIds.size,
      assetIds: Array.from(selectedIds),
    });
  };

  return (
    <div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Control Panel ── */}
      <div className="daily-recording-panel" style={{
        background: "linear-gradient(135deg, #f0f7ff 0%, #f5f3ff 100%)",
        border: "1px solid #bfdbfe",
        borderRadius: 16,
        padding: "20px 22px",
        marginBottom: 18,
        boxShadow: "0 2px 12px rgba(37,99,235,0.06)",
      }}>

        {/* Section: กำหนดเวลาตรวจสอบ */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            ⏱ กำหนดเวลาตรวจสอบ
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1.4fr) minmax(0,1.4fr) minmax(0,1fr)", gap: 10 }}>

            {/* Shift */}
            <div className="daily-recording-field-card" style={{ background: "#fff", borderColor: "#bfdbfe", minWidth: 0 }}>
              <div className="daily-recording-label">เวรที่บันทึก</div>
              <select
                value={selectedShift}
                onChange={(e) => {
                  const shift = e.target.value as InspectionShiftKey;
                  setSelectedShift(shift);
                  const defaults = shiftDefaultSlots[shift];
                  if (defaults && defaults.length > 0) setSelectedSlot(defaults[0]);
                }}
              >
                {SHIFTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {/* Time Slot */}
            <div className="daily-recording-field-card" style={{ background: "#fff", borderColor: "#bfdbfe", minWidth: 0 }}>
              <div className="daily-recording-label">ช่วงเวลาตรวจสอบ</div>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value as InspectionTimeSlotKey)}
              >
                {visibleSlots.map((slot) => <option key={slot} value={slot}>{inspectionTimeSlotLabels[slot]}</option>)}
              </select>
            </div>

            {/* Duration */}
            <div className="daily-recording-field-card" style={{ background: "#fff", borderColor: "#c4b5fd", minWidth: 0 }}>
              <div className="daily-recording-label" style={{ color: "#7c3aed" }}>ระยะเวลาที่ใช้ตรวจสอบ</div>
              <select
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(Number(e.target.value) as DurationMinutes)}
              >
                {DURATION_OPTIONS.map((m) => <option key={m} value={m}>{m} นาที</option>)}
              </select>
            </div>

            {/* Computed Time Display */}
            <div style={{
              padding: "10px 12px", borderRadius: 12,
              background: "linear-gradient(135deg, #eff6ff, #f5f3ff)",
              border: "1px solid #c4b5fd", minWidth: 0,
              display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.05em" }}>เวลาตรวจ</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#4f46e5", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                {slotStart}–{slotEnd}
              </div>
              <div style={{ fontSize: 11, color: "#7c3aed" }}>{selectedDuration} นาที</div>
            </div>

          </div>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{
              padding: "10px 18px", borderRadius: 10, background: "#dcfce7", border: "1px solid #86efac",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#15803d" }}>บันทึกแล้ว</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#16a34a" }}>{recordedCount}<span style={{ fontSize: 14, color: "#6b7280" }}>/{totalCount}</span></div>
            </div>
            <div style={{
              padding: "10px 18px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#c2410c" }}>เหลือ</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#f59e0b" }}>{remainingCount}</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>ความคืบหน้า</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#2563eb" }}>{coveragePct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 8, background: "#e2e8f0", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${Math.min(coveragePct, 100)}%`,
                background: "linear-gradient(90deg, #2563eb, #7c3aed)",
                borderRadius: 8, transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Single Row Toolbar */}
      {editable && (
        <div className="daily-recording-actionbar" style={{ display: "flex", flexWrap: "nowrap", gap: 12, alignItems: "center", padding: "10px 12px" }}>
          {/* Left: Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={showOnlyUnrecorded}
                onChange={(e) => { setShowOnlyUnrecorded(e.target.checked); setSelectedIds(new Set()); }}
                style={{ accentColor: "#3b82f6", width: 14, height: 14 }}
              />
              ซ่อนที่บันทึกแล้ว
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#4338ca", cursor: "pointer", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() => allVisibleSelected ? deselectAll() : selectAllVisible()}
                style={{ accentColor: "#4f46e5", width: 14, height: 14 }}
              />
              เลือกทั้งหมด{selectedIds.size > 0 && <span style={{ marginLeft: 4, fontSize: 11, color: "#6366f1" }}>({selectedIds.size})</span>}
            </label>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1, minWidth: 8 }} />

          {/* Right: Actions */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {selectedIds.size > 0 && (
              <>
                <StatusSelector
                  compact
                  options={options}
                  value={bulkStatus}
                  placeholder="สถานะ..."
                  onChange={(code) => setBulkStatus(code as AssetStatusCode | "")}
                />
                <button
                  type="button"
                  onClick={requestBulkConfirm}
                  disabled={!bulkStatus || isSubmitting}
                  className="button"
                  style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, fontWeight: 700, whiteSpace: "nowrap" }}
                >
                  {isSubmitting ? "..." : "บันทึก"}
                </button>
                <span style={{ width: 1, height: 18, background: "#e2e8f0", margin: "0 4px" }} />
              </>
            )}
            {/* Status Legend */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowLegend(!showLegend)}
                style={{ background: "#ffffff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 8px", fontSize: 12, fontWeight: 600, color: "#2563eb", cursor: "pointer", minWidth: 32 }}
                title="รหัสสถานะ"
              >
                ⓘ
              </button>
              {showLegend && (
                <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 8, background: "#fff", border: "1px solid #dbe6f5", borderRadius: 14, padding: 10, boxShadow: "0 18px 44px rgba(15,23,42,0.16)", zIndex: 100, minWidth: 250 }}>
                  {options.map((code) => (
                    <div key={code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", fontSize: 13, borderRadius: 10 }}>
                      <span className="status-picker-code" style={{ color: statusStyle(code).color, background: statusStyle(code).bg, borderColor: statusStyle(code).border }}>{code}</span>
                      <span style={{ color: "#334155", fontWeight: 800 }}>{statusLabels[code]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingStatusConfirm && (
        <ConfirmStatusDialog
          assetName={pendingStatusConfirm.assetName}
          mode={pendingStatusConfirm.mode}
          count={pendingStatusConfirm.count}
          statusCode={pendingStatusConfirm.statusCode}
          statusColor={STATUS_COLORS[pendingStatusConfirm.statusCode] ?? "#374151"}
          statusLabel={statusLabels[pendingStatusConfirm.statusCode as keyof typeof statusLabels] ?? pendingStatusConfirm.statusCode}
          shiftLabel={SHIFTS.find((s) => s.value === selectedShift)?.label ?? selectedShift}
          timeSlotLabel={inspectionTimeSlotLabels[selectedSlot] ?? selectedSlot}
          durationLabel={`${slotStart} – ${slotEnd} (${selectedDuration} นาที)`}
          isSubmitting={isSubmitting}
          onCancel={() => setPendingStatusConfirm(null)}
          onConfirm={() => {
            if (pendingStatusConfirm.mode === "bulk") {
              handleBulkSave(pendingStatusConfirm.statusCode, pendingStatusConfirm.assetIds ?? []);
            } else if (pendingStatusConfirm.assetId) {
              handleSingleSave(pendingStatusConfirm.assetId, pendingStatusConfirm.statusCode);
            }
            setPendingStatusConfirm(null);
          }}
        />
      )}


      {/* Empty State */}
      {assets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", border: "1px dashed #d1d5db", borderRadius: 12, background: "#f9fafb" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>▣</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#334155", marginBottom: 4 }}>
            {categoryCode === "STORAGE" ? "ยังไม่มีรายการ Storage Device" : "ยังไม่มีรายการทรัพย์สิน"}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
            {categoryCode === "STORAGE"
              ? "กรุณาเพิ่มข้อมูลที่ Master Data > Storage Device ก่อนเริ่มตรวจสอบ"
              : "กรุณาเพิ่มข้อมูลบัญชีทรัพย์สินก่อนเริ่มตรวจสอบ"}
          </div>
          {categoryCode === "STORAGE" ? (
            <a
              href="/admin/assets/storage"
              style={{ display: "inline-flex", padding: "8px 14px", borderRadius: 10, background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 800, textDecoration: "none" }}
            >
              ไปที่ Storage Device
            </a>
          ) : null}
        </div>
      ) : showOnlyUnrecorded && filteredAssets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", border: "1px dashed #d1d5db", borderRadius: 12, background: "#f9fafb" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#059669", marginBottom: 4 }}>บันทึกครบแล้ว</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>ไม่มีรายการที่ต้องบันทึกเพิ่มเติม</div>
        </div>
      ) : (
        /* Asset Table */
        <div className="daily-recording-table-wrap">
          <table className="daily-recording-table">
            <thead>
              <tr style={{ background: "linear-gradient(135deg, #eff6ff, #f5f3ff)" }}>
                {editable && <th style={{ width: 36, padding: "10px 8px", textAlign: "center" }}></th>}
                <th style={{ padding: "13px 12px", textAlign: "left", fontWeight: 800, color: "#334155", width: 50 }}>ลำดับ</th>
                <th style={{ padding: "13px 12px", textAlign: "left", fontWeight: 800, color: "#334155" }}>รายการ</th>
                <th style={{ padding: "13px 12px", textAlign: "center", fontWeight: 800, color: "#334155", width: 120 }}>สถานะ</th>
                <th style={{ padding: "13px 12px", textAlign: "left", fontWeight: 800, color: "#334155", width: 120 }}>ผู้บันทึก</th>
                <th style={{ padding: "13px 12px", textAlign: "left", fontWeight: 800, color: "#334155", width: 120 }}>เวร/ช่วงเวลา</th>
                <th style={{ padding: "13px 12px", textAlign: "left", fontWeight: 800, color: "#334155", width: 100 }}>วันที่บันทึก</th>
                <th style={{ padding: "13px 12px", textAlign: "left", fontWeight: 800, color: "#334155", width: 90 }}>เวลาที่บันทึก</th>
                {editable && <th style={{ padding: "13px 12px", textAlign: "center", fontWeight: 800, color: "#334155", width: 80 }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => {
                const entry = entryMap.get(asset.id);
                const isRecorded = !!entry;
                const canEdit = canEditEntry(entry);
                const isSelected = selectedIds.has(asset.id);

                return (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    entry={entry}
                    isRecorded={isRecorded}
                    canEdit={canEdit}
                    isSelected={isSelected}
                    editable={editable}
                    options={options}
                    onToggleSelect={() => toggleSelect(asset.id)}
                    onStatusSelect={(id: string, code: AssetStatusCode, name: string, mode: "single" | "edit" = "single") => setPendingStatusConfirm({ mode, assetId: id, statusCode: code, assetName: name })}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusSelector({
  options,
  value,
  onChange,
  onConfirm,
  placeholder = "เลือกสถานะ",
  compact = false,
}: {
  options: AssetStatusCode[];
  value: AssetStatusCode | "";
  onChange: (value: AssetStatusCode | "") => void;
  onConfirm?: (value: AssetStatusCode) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; minWidth: number; maxHeight: number; placement: "top" | "bottom" } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const preferredWidth = compact ? 220 : 258;
    const minWidth = Math.max(rect.width, preferredWidth);
    const viewportPadding = 12;
    const gap = 8;
    const preferredMenuHeight = Math.min(340, Math.max(220, options.length * 58 + 20));
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const placement = spaceBelow < preferredMenuHeight && spaceAbove > spaceBelow ? "top" : "bottom";
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, viewportPadding + minWidth / 2),
      window.innerWidth - viewportPadding - minWidth / 2
    );
    const top = placement === "top" ? rect.top - gap : rect.bottom + gap;
    const availableHeight = placement === "top" ? spaceAbove - gap : spaceBelow - gap;
    setMenuPosition({
      top,
      left,
      minWidth,
      maxHeight: Math.max(180, Math.min(340, availableHeight)),
      placement,
    });
  }, [compact, options.length]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const handleSelect = (code: AssetStatusCode) => {
    onChange(code);
    setIsOpen(false);
    onConfirm?.(code);
  };

  const selectedStyle = value ? statusStyle(value) : null;

  return (
    <div ref={containerRef} className="status-picker">
      <button
        type="button"
        onClick={() => {
          if (!isOpen) updateMenuPosition();
          setIsOpen(!isOpen);
        }}
        className={`status-picker-trigger${compact ? " status-picker-trigger--compact" : ""}${value ? " is-selected" : ""}`}
        style={selectedStyle ? { borderColor: selectedStyle.border, background: `linear-gradient(180deg, #ffffff 0%, ${selectedStyle.soft} 100%)` } : undefined}
      >
        <span className="status-picker-trigger-content">
          {value ? (
            <>
              <span className="status-picker-code" style={{ color: selectedStyle!.color, background: selectedStyle!.bg, borderColor: selectedStyle!.border }}>{value}</span>
              {!compact && <span className="status-picker-current-label">{statusLabels[value as keyof typeof statusLabels]}</span>}
            </>
          ) : (
            <span className="status-picker-placeholder">{placeholder}</span>
          )}
        </span>
        <span className="status-picker-chevron">▾</span>
      </button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="status-picker-menu status-picker-menu--portal"
          style={{
            top: menuPosition?.top ?? 0,
            left: menuPosition?.left ?? 0,
            minWidth: menuPosition?.minWidth,
            maxHeight: menuPosition?.maxHeight,
            transform: menuPosition?.placement === "top" ? "translate(-50%, -100%)" : "translateX(-50%)",
          }}
        >
          {options.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => handleSelect(code)}
              className={`status-picker-option${value === code ? " is-active" : ""}`}
              style={{ ["--status-soft" as string]: statusStyle(code).soft, ["--status-border" as string]: statusStyle(code).border }}
            >
              <span className="status-picker-code status-picker-code--large" style={{ color: statusStyle(code).color, background: statusStyle(code).bg, borderColor: statusStyle(code).border }}>{code}</span>
              <span className="status-picker-option-text">
                <span>{statusLabels[code]}</span>
                <small>รหัส {code}</small>
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function AssetRow({
  asset,
  entry,
  isRecorded,
  canEdit,
  isSelected,
  editable,
  options,
  onToggleSelect,
  onStatusSelect,
}: {
  asset: DailyAsset;
  entry: DailyEntry | undefined;
  isRecorded: boolean;
  canEdit: boolean;
  isSelected: boolean;
  editable: boolean;
  options: AssetStatusCode[];
  onToggleSelect: () => void;
  onStatusSelect: (assetId: string, statusCode: AssetStatusCode, assetName: string, mode?: "single" | "edit") => void;
}) {
  const [localStatus, setLocalStatus] = useState<AssetStatusCode | "">("");
  const [editing, setEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<AssetStatusCode | "">(entry?.statusCode ?? "");

  const recorder = entry?.updatedBy?.displayName ?? entry?.recordedBy?.displayName ?? "";
  const timeLabel = entry?.timeSlot ? (inspectionTimeSlotLabels[entry.timeSlot as InspectionTimeSlotKey] ?? entry.timeSlot) : "";
  const entryDate = entry?.updatedAt
    ? new Date(entry.updatedAt).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";
  const entryTime = entry?.updatedAt
    ? new Date(entry.updatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
    : "";

  const rowBg = isRecorded ? "#fafffe" : isSelected ? "#eef2ff" : "#fff";

  return (
    <tr style={{ borderBottom: "1px solid #e8eef7", background: rowBg }}>
      {editable && (
        <td style={{ padding: "11px 8px", textAlign: "center" }}>
          {!isRecorded && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              style={{ accentColor: "#4f46e5", width: 16, height: 16 }}
            />
          )}
        </td>
      )}
      <td style={{ padding: "11px 12px", color: "#64748b", fontSize: 14 }}>{asset.displayOrder}</td>
      <td style={{ padding: "11px 12px", color: "#1e293b", fontSize: 15 }}>
        <div style={{ fontWeight: 800 }}>{asset.name}</div>
      </td>
      <td style={{ padding: "11px 12px", textAlign: "center" }}>
        {isRecorded && !editing ? (
          <span className="recorded-status-pill" style={{ color: statusStyle(entry!.statusCode).color, background: statusStyle(entry!.statusCode).bg, borderColor: statusStyle(entry!.statusCode).border }}>
            ✓ {entry!.statusCode}
          </span>
        ) : editing ? (
          <StatusSelector
            compact
            options={options}
            value={editStatus}
            onChange={setEditStatus}
          />
        ) : (
          <StatusSelector
            options={options}
            value={localStatus}
            onChange={setLocalStatus}
            onConfirm={(code) => onStatusSelect(asset.id, code, asset.name)}
          />
        )}
      </td>
      <td style={{ padding: "11px 12px", fontSize: 14, color: "#64748b" }}>{recorder}</td>
      <td style={{ padding: "11px 12px", fontSize: 13, color: "#64748b" }}>{timeLabel}</td>
      <td style={{ padding: "11px 12px", fontSize: 13, color: "#64748b" }}>{entryDate}</td>
      <td style={{ padding: "11px 12px", fontSize: 13, color: "#64748b" }}>{entryTime}</td>
      {editable && (
        <td style={{ padding: "11px 12px", textAlign: "center" }}>
          {isRecorded && !editing && canEdit ? (
            <button
              type="button"
              onClick={() => { setEditing(true); setEditStatus(entry!.statusCode); }}
              style={{ fontSize: 13, padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", color: "#475569", fontWeight: 700 }}
            >
              แก้ไข
            </button>
          ) : editing ? (
            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => { if (editStatus) onStatusSelect(asset.id, editStatus, asset.name, "edit"); setEditing(false); }}
                style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontWeight: 700 }}
              >
                บันทึก
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", color: "#6b7280", fontWeight: 700 }}
              >
                ยกเลิก
              </button>
            </div>
          ) : !isRecorded && localStatus ? (
            <button
              type="button"
              onClick={() => onStatusSelect(asset.id, localStatus, asset.name, "single")}
              style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontWeight: 800 }}
            >
              บันทึก
            </button>
          ) : null}
        </td>
      )}
    </tr>
  );
}

function ConfirmStatusDialog({
  mode,
  assetName,
  count,
  statusCode,
  statusColor,
  statusLabel,
  shiftLabel,
  timeSlotLabel,
  durationLabel,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  mode: "single" | "bulk" | "edit";
  assetName: string;
  count?: number;
  statusCode: string;
  statusColor: string;
  statusLabel: string;
  shiftLabel: string;
  timeSlotLabel: string;
  durationLabel?: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title = mode === "bulk" ? "ยืนยันการบันทึกหลายรายการ" : mode === "edit" ? "ยืนยันการแก้ไขสถานะ" : "ยืนยันการบันทึกสถานะ";
  const subtitle = mode === "bulk" ? "ตรวจสอบจำนวนรายการและสถานะก่อนบันทึก" : "ตรวจสอบรายละเอียดก่อนบันทึกข้อมูล";
  const description = mode === "bulk"
    ? <>ต้องการบันทึกสถานะ <strong style={{ color: statusColor }}>{statusCode} ({statusLabel})</strong> ให้รายการที่เลือกทั้งหมดใช่หรือไม่?</>
    : <>ต้องการ{mode === "edit" ? "แก้ไข" : "บันทึก"}สถานะ <strong style={{ color: statusColor }}>{statusCode} ({statusLabel})</strong> สำหรับรายการนี้ใช่หรือไม่?</>;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-status-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(15, 23, 42, 0.52)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)"
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          borderRadius: 16,
          overflow: "hidden",
          background: "#ffffff",
          border: "1px solid rgba(219, 230, 245, 0.95)",
          boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)"
        }}
      >
        <div style={{ padding: "22px 24px", background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 54%, #7c3aed 100%)", color: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.18)", fontSize: 24 }}>
              ✓
            </div>
            <div>
              <div id="confirm-status-title" style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.2 }}>
                {title}
              </div>
              <div style={{ marginTop: 4, fontSize: 14, opacity: 0.9 }}>
                {subtitle}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 16, color: "#334155", lineHeight: 1.6, marginBottom: 18 }}>
            {description}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div style={{ padding: 14, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#15803d", marginBottom: 6 }}>สถานะ</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: statusColor }}>{statusCode}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#c2410c", marginBottom: 6 }}>{mode === "bulk" ? "จำนวนรายการ" : "รายการ"}</div>
              <div style={{ fontSize: mode === "bulk" ? 24 : 16, fontWeight: 900, color: "#f59e0b" }}>{mode === "bulk" ? `${count ?? 0} รายการ` : assetName}</div>
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 12, background: "#f8fbff", border: "1px solid #dbeafe", color: "#475569", fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
            <div><strong>เวรที่บันทึก:</strong> {shiftLabel}</div>
            <div><strong>ช่วงเวลา:</strong> {timeSlotLabel}</div>
            {durationLabel && <div><strong>ระยะเวลาตรวจสอบ:</strong> {durationLabel}</div>}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              style={{
                border: "1px solid #dbe6f5",
                background: "#ffffff",
                color: "#475569",
                borderRadius: 10,
                padding: "11px 18px",
                fontSize: 15,
                fontWeight: 800,
                cursor: isSubmitting ? "not-allowed" : "pointer"
              }}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              style={{
                border: "none",
                background: "linear-gradient(135deg, #16a34a, #0ea5e9)",
                color: "#ffffff",
                borderRadius: 10,
                padding: "11px 20px",
                fontSize: 15,
                fontWeight: 900,
                boxShadow: "0 10px 24px rgba(22, 163, 74, 0.28)",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.72 : 1
              }}
            >
              {isSubmitting ? "กำลังบันทึก..." : "ยืนยันบันทึก"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
