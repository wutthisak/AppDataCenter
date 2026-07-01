"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetCategoryCode } from "@prisma/client";
import { resetDayEntriesRangeAction } from "@/app/actions";
import { Toast } from "@/components/Toast";

export function ResetModal({
  reportId,
  categoryCode,
  maxDay,
  returnTo
}: {
  reportId: string;
  categoryCode: AssetCategoryCode;
  maxDay: number;
  returnTo: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [startDay, setStartDay] = useState<number | "">("");
  const [endDay, setEndDay] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const router = useRouter();
  const canSubmit = !!startDay && !!endDay && Number(startDay) <= Number(endDay);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const start = Number(startDay);
    const end = Number(endDay);

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("reportId", reportId);
      formData.append("categoryCode", categoryCode);
      formData.append("startDay", String(start));
      formData.append("endDay", String(end));
      formData.append("returnTo", returnTo);

      const result = await resetDayEntriesRangeAction(formData);
      if (!result.ok) {
        throw new Error(result.error || "reset_failed");
      }

      setIsOpen(false);
      setStartDay("");
      setEndDay("");
      setIsSubmitting(false);
      setToastMessage(`ลบข้อมูลเรียบร้อยแล้ว (${result.deleted} รายการ)`);
      router.refresh();
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        className="button secondary"
        onClick={() => setIsOpen(true)}
        title="รีเซ็ตข้อมูล"
      >
        รีเซ็ต
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setIsOpen(false)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="reset-range-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="reset-range-modal-title">รีเซ็ตข้อมูล</h2>
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
                  เลือกช่วงวันที่ต้องการรีเซ็ต
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
                        <option key={day} value={day}>
                          วันที่ {day}
                        </option>
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
                        <option key={day} value={day}>
                          วันที่ {day}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="warning-message">
                <strong>⚠️ คำเตือน:</strong> การรีเซ็ตจะลบข้อมูลสถานะทั้งหมดของวันที่เลือกออก ไม่สามารถย้อนกลับได้
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
                  className="button danger"
                  disabled={isSubmitting || !canSubmit}
                >
                  {isSubmitting ? "กำลังรีเซ็ต..." : "ยืนยันรีเซ็ต"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toastMessage && (
        <Toast
          message={toastMessage}
          variant="error"
          onClose={() => setToastMessage("")}
        />
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
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          max-width: 400px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease-out;
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

        .warning-message {
          background-color: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 20px;
          color: #856404;
          font-size: 0.9rem;
          line-height: 1.5;
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

        .button.danger {
          background-color: #d32f2f;
          color: white;
          border-color: #d32f2f;
        }

        .button.danger:hover:not(:disabled) {
          background-color: #b71c1c;
          border-color: #b71c1c;
        }

        .button.danger:disabled {
          background-color: #ccc;
          border-color: #ccc;
          opacity: 0.6;
        }
      `}</style>
    </>
  );
}
