"use client";
// @ts-nocheck

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
// import type { AssetCategoryCode, AssetStatusCode } from "@prisma/client";
type AssetCategoryCode = "VM" | "SERVER" | "NETWORK" | "BACKUP";
type AssetStatusCode = "N" | "H" | "F" | "D" | "C" | "R";
import { upsertStatusAction, bulkUpsertStatusAction } from "@/app/actions";
import { statusLabels } from "@/lib/constants";
import { inspectionShiftLabels, inspectionTimeSlotLabels, shiftDefaultSlots } from "@/lib/inspection-shifts";
import type { InspectionShiftKey, InspectionTimeSlotKey } from "@/lib/inspection-shifts";

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

export function DailyRecordingView({
  reportId,
  categoryCode,
  assets,
  day,
  entries,
  options,
  returnTo,
  editable,
  userId,
  userRole,
}: {
  reportId: string;
  categoryCode: AssetCategoryCode;
  assets: { id: string; displayOrder: number; name: string; active: boolean }[];
  day: number;
  entries: DailyEntry[];
  options: AssetStatusCode[];
  returnTo: string;
  editable: boolean;
  userId?: string;
  userRole?: string;
}) {
  const router = useRouter();
  const [selectedShift, setSelectedShift] = useState<InspectionShiftKey>("OFFICE_HOURS");
  const [selectedSlot, setSelectedSlot] = useState<InspectionTimeSlotKey>("SLOT_0800_0900");
  const [showOnlyUnrecorded, setShowOnlyUnrecorded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<AssetStatusCode | "">("");
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
      for (const id of assetIds) formData.append("assetIds", id);
      await bulkUpsertStatusAction(formData);
    } catch (err) {
      console.error(err);
    }
    setIsSubmitting(false);
    setSelectedIds(new Set());
    setBulkStatus("");
    router.refresh();
  };

  // Single row save
  const handleSingleSave = async (assetId: string, statusCode: string) => {
    const formData = new FormData();
    formData.append("reportId", reportId);
    formData.append("assetId", assetId);
    formData.append("day", String(day));
    formData.append("statusCode", statusCode);
    formData.append("timeSlot", selectedSlot);
    formData.append("returnTo", returnTo);
    await upsertStatusAction(formData);
    router.refresh();
  };

  const requestBulkConfirm = () => {
    if (!bulkStatus || selectedIds.size === 0) return;
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
      {/* Control Bar */}
      <div className="daily-recording-panel">
        <div className="daily-recording-grid">
          {/* Shift */}
          <div className="daily-recording-field-card">
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
          <div className="daily-recording-field-card">
            <div className="daily-recording-label">ช่วงเวลา</div>
            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value as InspectionTimeSlotKey)}
            >
              {visibleSlots.map((slot) => <option key={slot} value={slot}>{inspectionTimeSlotLabels[slot]}</option>)}
            </select>
          </div>
          {/* Progress */}
          <div className="daily-recording-stat daily-recording-stat--done">
            <div className="daily-recording-label">บันทึกแล้ว</div>
            <div className="daily-recording-stat-value">
              {recordedCount}/{totalCount}
            </div>
          </div>
          <div className="daily-recording-stat daily-recording-stat--remaining">
            <div className="daily-recording-label">เหลือ</div>
            <div className="daily-recording-stat-value">
              {remainingCount}
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="daily-recording-progress">
          <div className="daily-recording-progress-track">
            <div className="daily-recording-progress-bar" style={{ width: `${Math.min(coveragePct, 100)}%` }} />
          </div>
          <span>{coveragePct}%</span>
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
      {showOnlyUnrecorded && filteredAssets.length === 0 ? (
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
                <th style={{ padding: "13px 12px", textAlign: "left", fontWeight: 800, color: "#334155", width: 130 }}>เวลาบันทึก</th>
                <th style={{ padding: "13px 12px", textAlign: "left", fontWeight: 800, color: "#334155", width: 100 }}>หมายเหตุ</th>
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        onClick={() => setIsOpen(!isOpen)}
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

      {isOpen && (
        <div className="status-picker-menu">
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
        </div>
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
  asset: { id: string; displayOrder: number; name: string };
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
  const dateStr = entry?.updatedAt
    ? new Date(entry.updatedAt).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
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
      <td style={{ padding: "11px 12px", fontWeight: 700, color: "#1e293b", fontSize: 15 }}>{asset.name}</td>
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
      <td style={{ padding: "11px 12px", fontSize: 13, color: "#64748b" }}>{dateStr}</td>
      <td style={{ padding: "11px 12px", fontSize: 13, color: "#64748b" }}>{entry?.note ?? ""}</td>
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
