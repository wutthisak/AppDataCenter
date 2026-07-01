"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetCategoryCode, AssetStatusCode } from "@prisma/client";
import { bulkUpsertStatusRangeAction } from "@/app/actions";
import { CalendarDays, Clock, Timer, CheckCircle2, X } from "lucide-react";
import {
  shiftDefaultSlots,
  inspectionTimeSlotLabels,
  type InspectionShiftKey,
  type InspectionTimeSlotKey
} from "@/lib/inspection-shifts";

const SHIFT_OPTIONS: { value: InspectionShiftKey; label: string; sub: string; color: string }[] = [
  { value: "OFFICE_HOURS",    label: "ในเวลาราชการ", sub: "08:00 – 16:00 น.", color: "#2563eb" },
  { value: "MORNING_SHIFT",   label: "เวรเช้า",       sub: "08:00 – 16:00 น.", color: "#14b8a6" },
  { value: "AFTERNOON_SHIFT", label: "เวรบ่าย",       sub: "16:00 – 24:00 น.", color: "#f97316" },
  { value: "NIGHT_SHIFT",     label: "เวรดึก",        sub: "00:00 – 08:00 น.", color: "#8b5cf6" },
];

const DURATION_OPTIONS = [
  { value: 5,  label: "5 นาที" },
  { value: 10, label: "10 นาที" },
  { value: 15, label: "15 นาที" },
  { value: 30, label: "30 นาที" },
  { value: 45, label: "45 นาที" },
  { value: 60, label: "1 ชั่วโมง" },
];

export function SaveAllStatusesModal({
  reportId,
  categoryCode,
  options,
  maxDay,
  returnTo
}: {
  reportId: string;
  categoryCode: AssetCategoryCode;
  options: AssetStatusCode[];
  maxDay: number;
  returnTo: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [startDay, setStartDay] = useState<number | "">("");
  const [endDay, setEndDay] = useState<number | "">("");
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");
  const [selectedShift, setSelectedShift] = useState<InspectionShiftKey | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slotStatus, setSlotStatus] = useState<Record<string, string>>({});
  const router = useRouter();

  const currentSlots: InspectionTimeSlotKey[] = selectedShift
    ? shiftDefaultSlots[selectedShift]
    : [];

  const handleShiftChange = (shift: InspectionShiftKey | "") => {
    setSelectedShift(shift);
    setSlotStatus({});
  };

  const setStatusForSlot = (slot: string, status: string) => {
    setSlotStatus((prev) => ({ ...prev, [slot]: status }));
  };

  const activeSlots = currentSlots.filter((s) => slotStatus[s]);
  const canSubmit = !!startDay && !!endDay && !!selectedShift && Number(startDay) <= Number(endDay) && activeSlots.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const start = Number(startDay);
    const end = Number(endDay);

    setIsSubmitting(true);
    try {
      for (const slot of activeSlots) {
        const statusCode = slotStatus[slot];
        if (!statusCode) continue;
        const formData = new FormData();
        formData.append("reportId", reportId);
        formData.append("categoryCode", categoryCode);
        formData.append("startDay", String(start));
        formData.append("endDay", String(end));
        formData.append("statusCode", statusCode);
        formData.append("returnTo", returnTo);
        formData.append("timeSlots", slot);
        if (selectedShift) formData.append("inspectionShift", selectedShift);
        if (durationMinutes) formData.append("durationMinutes", String(durationMinutes));
        const result = await bulkUpsertStatusRangeAction(formData);
        if (!result.ok) throw new Error(result.error);
      }

      setIsOpen(false);
      setStartDay("");
      setEndDay("");
      setDurationMinutes("");
      setSelectedShift("");
      setSlotStatus({});
      setIsSubmitting(false);
      router.replace(`${returnTo}${returnTo.includes("?") ? "&" : "?"}__refresh=${Date.now()}`);
      router.refresh();
    } catch (error) {
      console.error("Error saving statuses:", error);
      setIsSubmitting(false);
    }
  };

  const getSelectedDaysCount = () => {
    if (!startDay || !endDay) return 0;
    const start = Number(startDay);
    const end = Number(endDay);
    return end >= start ? end - start + 1 : 0;
  };

  return (
    <>
      <button className="button secondary" onClick={() => setIsOpen(true)} title="บันทึกสถานะทั้งหมด">
        บันทึกทั้งหมด
      </button>

      {isOpen && (
        <div className="sam-overlay" onClick={() => !isSubmitting && setIsOpen(false)}>
          <div className="sam-modal" role="dialog" aria-modal="true" aria-labelledby="save-all-statuses-title" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="sam-header">
              <div className="sam-header-icon"><CalendarDays size={20} /></div>
              <div>
                <h2 id="save-all-statuses-title">บันทึกสถานะทั้งหมด</h2>
                <p>เลือกช่วงวันที่และสถานะที่ต้องการบันทึกพร้อมกัน</p>
              </div>
              <button type="button" className="sam-close" onClick={() => !isSubmitting && setIsOpen(false)} disabled={isSubmitting}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="sam-body">

              {/* Shift Selector */}
              <div className="sam-section">
                <div className="sam-section-label"><Clock size={14} /> เวรที่บันทึก <span className="sam-required">*</span></div>
                <div className="sam-shift-row">
                  {SHIFT_OPTIONS.map((sh) => (
                    <button
                      key={sh.value}
                      type="button"
                      className={`sam-shift-card${selectedShift === sh.value ? " sam-shift-card--active" : ""}`}
                      style={{ "--shift-color": sh.color } as React.CSSProperties}
                      onClick={() => handleShiftChange(selectedShift === sh.value ? "" : sh.value)}
                      disabled={isSubmitting}
                    >
                      <span className="sam-shift-dot" />
                      <div>
                        <strong>{sh.label}</strong>
                        <span>{sh.sub}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="sam-section">
                <div className="sam-section-label"><CalendarDays size={14} /> ช่วงวันที่ <span className="sam-required">*</span></div>
                <div className="sam-date-row">
                  <div className="sam-field">
                    <span className="sam-sub-label">จากวันที่</span>
                    <select value={startDay} onChange={(e) => setStartDay(e.target.value ? Number(e.target.value) : "")} disabled={isSubmitting} required>
                      <option value="">เลือก...</option>
                      {Array.from({ length: maxDay }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>วันที่ {day}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sam-date-sep">→</div>
                  <div className="sam-field">
                    <span className="sam-sub-label">ถึงวันที่</span>
                    <select value={endDay} onChange={(e) => setEndDay(e.target.value ? Number(e.target.value) : "")} disabled={isSubmitting} required>
                      <option value="">เลือก...</option>
                      {Array.from({ length: maxDay }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>วันที่ {day}</option>
                      ))}
                    </select>
                  </div>
                  {getSelectedDaysCount() > 0 && (
                    <div className="sam-day-badge">{getSelectedDaysCount()} วัน</div>
                  )}
                </div>
              </div>

              {/* Duration */}
              <div className="sam-section">
                <div className="sam-section-label"><Timer size={14} /> ระยะเวลาที่ใช้ตรวจสอบ</div>
                <div className="sam-duration-grid">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`sam-dur-chip${durationMinutes === opt.value ? " sam-dur-chip--active" : ""}`}
                      onClick={() => setDurationMinutes(durationMinutes === opt.value ? "" : opt.value)}
                      disabled={isSubmitting}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {durationMinutes && (
                  <p className="sam-hint sam-hint--blue"><Clock size={12} /> บันทึกระยะเวลา <strong>{durationMinutes} นาที</strong> ต่อรอบตรวจ</p>
                )}
              </div>

              {/* Time Slots */}
              {selectedShift && (
                <div className="sam-section">
                  <div className="sam-section-label"><Clock size={14} /> ช่วงเวลาและสถานะ <span className="sam-required">*</span></div>
                  <div className="sam-slot-grid">
                    {currentSlots.map((slot) => {
                      const status = slotStatus[slot] || "";
                      const active = !!status;
                      return (
                        <div key={slot} className={`sam-slot${active ? " sam-slot--active" : ""}`}>
                          <div className="sam-slot-time">{inspectionTimeSlotLabels[slot]}</div>
                          <select
                            value={status}
                            onChange={(e) => setStatusForSlot(slot, e.target.value)}
                            disabled={isSubmitting}
                            className="sam-slot-select"
                          >
                            <option value="">-</option>
                            {options.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          {active && <div className="sam-slot-dot" />}
                        </div>
                      );
                    })}
                  </div>
                  {activeSlots.length === 0 && (
                    <p className="sam-hint">เลือกสถานะอย่างน้อย 1 ช่วงเวลา</p>
                  )}
                  {activeSlots.length > 0 && (
                    <p className="sam-hint sam-hint--purple">
                      <CheckCircle2 size={12} /> บันทึก <strong>{activeSlots.length} ช่วงเวลา</strong>
                      {getSelectedDaysCount() > 0 ? ` × ${getSelectedDaysCount()} วัน = ${activeSlots.length * getSelectedDaysCount()} รายการ` : ""}
                    </p>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="sam-footer">
                <button type="button" className="sam-btn-cancel" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                  ยกเลิก
                </button>
                <button type="submit" className="sam-btn-submit" disabled={isSubmitting || !canSubmit}
                >
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .sam-overlay {
          position: fixed; inset: 0;
          background: rgba(15,23,42,0.55);
          backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1200;
          padding: 1rem;
        }
        .sam-modal {
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 24px 64px rgba(15,23,42,0.18);
          width: 100%; max-width: 540px;
          max-height: 90vh; overflow-y: auto;
          animation: samIn 0.2s ease-out;
        }
        @keyframes samIn {
          from { opacity:0; transform:translateY(16px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .sam-header {
          display: flex; align-items: center; gap: 12px;
          padding: 18px 20px 14px;
          border-bottom: 1px solid #f1f5f9;
        }
        .sam-header-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: linear-gradient(135deg,#2563eb,#7c3aed);
          display: flex; align-items: center; justify-content: center;
          color: #fff; flex-shrink: 0;
        }
        .sam-header h2 { margin: 0; font-size: 1.05rem; font-weight: 700; color: #0f172a; }
        .sam-header p  { margin: 0; font-size: 0.78rem; color: #64748b; }
        .sam-header > div:last-child { margin-left: auto; }
        .sam-close {
          width: 32px; height: 32px; border-radius: 8px;
          border: none; background: #f1f5f9; color: #64748b;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.15s;
        }
        .sam-close:hover:not(:disabled) { background: #e2e8f0; color: #0f172a; }
        .sam-close:disabled { opacity: 0.4; cursor: not-allowed; }

        .sam-body { padding: 0 20px 20px; display: flex; flex-direction: column; gap: 18px; margin-top: 16px; }

        .sam-section {}
        .sam-section-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.8rem; font-weight: 600; color: #475569;
          text-transform: uppercase; letter-spacing: 0.04em;
          margin-bottom: 10px;
        }
        .sam-required { color: #ef4444; }

        /* Date row */
        .sam-date-row {
          display: flex; align-items: flex-end; gap: 8px;
        }
        .sam-field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .sam-sub-label { font-size: 0.75rem; font-weight: 500; color: #64748b; }
        .sam-field select {
          padding: 8px 10px; border: 1.5px solid #e2e8f0; border-radius: 8px;
          font-size: 0.88rem; font-family: inherit; background: #f8fafc;
          color: #0f172a; cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .sam-field select:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); background: #fff; }
        .sam-field select:disabled { opacity: 0.5; cursor: not-allowed; }
        .sam-date-sep { color: #94a3b8; font-size: 1rem; padding-bottom: 8px; flex-shrink: 0; }
        .sam-day-badge {
          background: #dbeafe; color: #1d4ed8;
          font-size: 0.75rem; font-weight: 700;
          padding: 4px 10px; border-radius: 20px; white-space: nowrap;
          flex-shrink: 0; margin-bottom: 1px;
        }

        /* Shift selector */
        .sam-shift-row {
          display: grid; grid-template-columns: repeat(2,1fr); gap: 8px;
        }
        .sam-shift-card {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px;
          border: 1.5px solid #e2e8f0; background: #f8fafc;
          cursor: pointer; text-align: left;
          transition: all 0.15s;
        }
        .sam-shift-card:hover:not(:disabled) {
          border-color: var(--shift-color); background: #fff;
        }
        .sam-shift-card--active {
          border-color: var(--shift-color);
          background: color-mix(in srgb, var(--shift-color) 8%, white);
        }
        .sam-shift-card:disabled { opacity: 0.5; cursor: not-allowed; }
        .sam-shift-dot {
          width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
          background: var(--shift-color);
          transition: transform 0.15s;
        }
        .sam-shift-card--active .sam-shift-dot { transform: scale(1.3); }
        .sam-shift-card div { display: flex; flex-direction: column; gap: 1px; }
        .sam-shift-card strong { font-size: 0.83rem; font-weight: 700; color: #0f172a; }
        .sam-shift-card span { font-size: 0.73rem; color: #64748b; }
        .sam-shift-card--active strong { color: var(--shift-color); }

        /* Duration chips */
        .sam-duration-grid {
          display: flex; flex-wrap: wrap; gap: 8px;
        }
        .sam-dur-chip {
          padding: 6px 14px; border-radius: 20px;
          border: 1.5px solid #e2e8f0; background: #f8fafc;
          font-size: 0.82rem; font-weight: 600; color: #475569;
          cursor: pointer; transition: all 0.15s;
        }
        .sam-dur-chip:hover:not(:disabled) { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
        .sam-dur-chip--active { background: #2563eb; border-color: #2563eb; color: #fff; }
        .sam-dur-chip--active:hover:not(:disabled) { background: #1d4ed8; }
        .sam-dur-chip:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Hints */
        .sam-hint {
          display: flex; align-items: center; gap: 5px;
          font-size: 0.76rem; color: #94a3b8; margin: 6px 0 0;
        }
        .sam-hint--blue { color: #2563eb; }
        .sam-hint--purple { color: #7c3aed; }

        /* Slot grid */
        .sam-slot-grid {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 8px;
        }
        .sam-slot {
          position: relative;
          display: flex; flex-direction: column; gap: 6px;
          background: #f8fafc; border: 1.5px solid #e2e8f0;
          border-radius: 10px; padding: 10px 10px 8px;
          transition: all 0.15s;
        }
        .sam-slot--active {
          background: #faf5ff; border-color: #7c3aed;
        }
        .sam-slot-time {
          font-size: 0.76rem; font-weight: 700; color: #475569; white-space: nowrap;
        }
        .sam-slot--active .sam-slot-time { color: #5b21b6; }
        .sam-slot-select {
          width: 100%; padding: 5px 6px;
          border: 1.5px solid #e2e8f0; border-radius: 6px;
          font-size: 0.8rem; font-family: inherit;
          background: #fff; cursor: pointer;
          transition: border-color 0.15s;
        }
        .sam-slot--active .sam-slot-select { border-color: #7c3aed; }
        .sam-slot-select:focus { outline: none; border-color: #7c3aed; }
        .sam-slot-select:disabled { opacity: 0.5; }
        .sam-slot-dot {
          position: absolute; top: 8px; right: 8px;
          width: 7px; height: 7px; border-radius: 50%; background: #7c3aed;
        }

        /* Footer */
        .sam-footer {
          display: flex; justify-content: flex-end; gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid #f1f5f9;
          background: #f8fafc;
          border-radius: 0 0 16px 16px;
        }
        .sam-btn-cancel {
          padding: 9px 20px; border-radius: 8px;
          border: 1.5px solid #e2e8f0; background: #fff;
          font-size: 0.88rem; font-weight: 600; color: #475569;
          cursor: pointer; transition: all 0.15s;
        }
        .sam-btn-cancel:hover:not(:disabled) { background: #f1f5f9; border-color: #cbd5e1; }
        .sam-btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
        .sam-btn-submit {
          padding: 9px 24px; border-radius: 8px;
          border: none;
          background: linear-gradient(135deg,#2563eb,#7c3aed);
          font-size: 0.88rem; font-weight: 700; color: #fff;
          cursor: pointer; display: flex; align-items: center; gap: 7px;
          transition: opacity 0.15s, transform 0.1s;
        }
        .sam-btn-submit:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .sam-btn-submit:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
      `}</style>
    </>
  );
}
