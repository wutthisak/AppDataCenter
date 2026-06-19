"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteReportAction } from "@/app/actions";

export function DeleteReportButton({ reportId, label }: { reportId: string; label: string }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <form action={deleteReportAction}>
      <input type="hidden" name="reportId" value={reportId} />
      <button className="button danger report-delete-trigger" type="button" onClick={() => setIsOpen(true)}>
        <Trash2 size={16} />
        ลบ
      </button>

      {isOpen ? (
        <div className="confirm-modal-backdrop" role="presentation" onClick={() => setIsOpen(false)}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-report-title-${reportId}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="confirm-modal-close" type="button" aria-label="ปิด popup" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>

            <div className="confirm-modal-icon danger">
              <AlertTriangle size={26} />
            </div>

            <div className="confirm-modal-body">
              <p className="confirm-modal-eyebrow">ยืนยันการลบรายงาน</p>
              <h2 id={`delete-report-title-${reportId}`}>ลบรายงาน {label}?</h2>
              <p>
                ข้อมูลสถานะและ metric ในรายงานนี้จะถูกลบออกถาวร กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ
              </p>
            </div>

            <div className="confirm-modal-actions">
              <button className="button secondary" type="button" onClick={() => setIsOpen(false)}>
                ยกเลิก
              </button>
              <button className="button danger confirm-modal-danger" type="submit">
                <Trash2 size={17} />
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
