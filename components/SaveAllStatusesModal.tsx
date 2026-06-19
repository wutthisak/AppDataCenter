"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetCategoryCode, AssetStatusCode } from "@prisma/client";
import { bulkUpsertStatusRangeAction } from "@/app/actions";

const TIME_SLOTS = [
  { value: "SLOT_0800_0900", label: "08:00 - 09:00" },
  { value: "SLOT_0900_1000", label: "09:00 - 10:00" },
  { value: "SLOT_1100_1200", label: "11:00 - 12:00" },
  { value: "SLOT_1300_1400", label: "13:00 - 14:00" },
  { value: "SLOT_1400_1500", label: "14:00 - 15:00" },
  { value: "SLOT_1500_1600", label: "15:00 - 16:00" }
] as const;

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  // per-slot status: slotValue -> statusCode (empty = not selected for this slot)
  const [slotStatus, setSlotStatus] = useState<Record<string, string>>({});
  const router = useRouter();

  const setStatusForSlot = (slot: string, status: string) => {
    setSlotStatus((prev) => ({ ...prev, [slot]: status }));
  };

  const activeSlots = TIME_SLOTS.filter((s) => slotStatus[s.value]);
  const canSubmit = !!startDay && !!endDay && Number(startDay) <= Number(endDay) && activeSlots.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const start = Number(startDay);
    const end = Number(endDay);

    setIsSubmitting(true);
    try {
      // Submit one batch per (slot, status) combination
      for (const slot of activeSlots) {
        const statusCode = slotStatus[slot.value];
        if (!statusCode) continue;
        const formData = new FormData();
        formData.append("reportId", reportId);
        formData.append("categoryCode", categoryCode);
        formData.append("startDay", String(start));
        formData.append("endDay", String(end));
        formData.append("statusCode", statusCode);
        formData.append("returnTo", returnTo);
        formData.append("timeSlots", slot.value);
        const result = await bulkUpsertStatusRangeAction(formData);
        if (!result.ok) throw new Error(result.error);
      }

      setIsOpen(false);
      setStartDay("");
      setEndDay("");
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
      <button
        className="button secondary"
        onClick={() => setIsOpen(true)}
        title="บันทึกสถานะทั้งหมด"
      >
        บันทึกทั้งหมด
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>บันทึกสถานะทั้งหมด</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => !isSubmitting && setIsOpen(false)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>
                  เลือกช่วงวันที่
                  <span className="required">*</span>
                </label>
                <div className="date-range-inputs">
                  <div>
                    <label htmlFor="start-day" className="sub-label">จากวันที่</label>
                    <select
                      id="start-day"
                      value={startDay}
                      onChange={(e) => setStartDay(e.target.value ? Number(e.target.value) : "")}
                      disabled={isSubmitting}
                      required
                    >
                      <option value="">-</option>
                      {Array.from({ length: maxDay }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>วันที่ {day}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="end-day" className="sub-label">ถึงวันที่</label>
                    <select
                      id="end-day"
                      value={endDay}
                      onChange={(e) => setEndDay(e.target.value ? Number(e.target.value) : "")}
                      disabled={isSubmitting}
                      required
                    >
                      <option value="">-</option>
                      {Array.from({ length: maxDay }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>วันที่ {day}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {getSelectedDaysCount() > 0 && (
                  <p className="day-count">จำนวน <strong>{getSelectedDaysCount()} วัน</strong></p>
                )}
              </div>

              <div className="form-group">
                <label>
                  ช่วงเวลาและสถานะ
                  <span className="required">*</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#6b7280", marginLeft: 6 }}>เลือกช่วงเวลาที่ต้องการบันทึก</span>
                </label>
                <div className="slot-grid">
                  {TIME_SLOTS.map((slot) => {
                    const status = slotStatus[slot.value] || "";
                    const active = !!status;
                    return (
                      <div key={slot.value} className={`slot-card${active ? " slot-card--active" : ""}`}>
                        <div className="slot-time">{slot.label}</div>
                        <select
                          value={status}
                          onChange={(e) => setStatusForSlot(slot.value, e.target.value)}
                          disabled={isSubmitting}
                          className="slot-select"
                        >
                          <option value="">-</option>
                          {options.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
                {activeSlots.length === 0 && (
                  <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: "0.4rem 0 0" }}>เลือกสถานะอย่างน้อย 1 ช่วงเวลา</p>
                )}
                {activeSlots.length > 0 && (
                  <p style={{ fontSize: "0.75rem", color: "#7c3aed", margin: "0.4rem 0 0", fontWeight: 500 }}>
                    บันทึก {activeSlots.length} ช่วงเวลา
                    {getSelectedDaysCount() > 0 ? ` × ${getSelectedDaysCount()} วัน` : ""}
                  </p>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={isSubmitting || !canSubmit}
                >
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
          max-width: 520px;
          width: 95%;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.2s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e0e0e0;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #333;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .modal-close:hover:not(:disabled) {
          background-color: #f0f0f0;
          color: #333;
        }

        .modal-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-form {
          padding: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #333;
        }

        .required {
          color: #d32f2f;
          margin-left: 2px;
        }

        .form-group select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
          font-family: inherit;
          background-color: white;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .form-group select:hover:not(:disabled) {
          border-color: #999;
        }

        .form-group select:focus {
          outline: none;
          border-color: #0066cc;
          box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
        }

        .form-group select:disabled {
          background-color: #f5f5f5;
          color: #999;
          cursor: not-allowed;
        }

        .date-range-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 8px;
        }

        .date-range-inputs > div {
          display: flex;
          flex-direction: column;
        }

        .sub-label {
          font-size: 0.85rem;
          font-weight: 500;
          color: #666;
          margin-bottom: 4px !important;
          display: block !important;
        }

        .date-range-inputs select {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.95rem;
          font-family: inherit;
          background-color: white;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .day-count {
          font-size: 0.9rem;
          color: #0066cc;
          margin: 0;
          padding: 8px 0;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 20px;
          border-top: 1px solid #e0e0e0;
          background-color: #f9f9f9;
        }

        .modal-footer button {
          min-width: 100px;
        }
        .slot-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-top: 0.4rem;
        }

        .slot-card {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 8px;
          padding: 0.5rem 0.6rem;
          transition: all 0.15s;
        }

        .slot-card--active {
          background: #f5f3ff;
          border-color: #7c3aed;
        }

        .slot-time {
          font-size: 0.78rem;
          font-weight: 600;
          color: #4b5563;
          white-space: nowrap;
        }

        .slot-card--active .slot-time {
          color: #5b21b6;
        }

        .slot-select {
          width: 100%;
          padding: 0.25rem 0.3rem;
          border: 1px solid #d1d5db;
          border-radius: 5px;
          font-size: 0.82rem;
          font-family: inherit;
          background: white;
          cursor: pointer;
        }

        .slot-card--active .slot-select {
          border-color: #7c3aed;
        }
      `}</style>
    </>
  );
}
