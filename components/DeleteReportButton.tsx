"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteReportAction } from "@/app/actions";

export function DeleteReportButton({ reportId, label }: { reportId: string; label: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const modal = isOpen && mounted ? createPortal(
    <div
      className="confirm-modal"
      role="presentation"
      onClick={() => setIsOpen(false)}
    >
      <div className="confirm-modal-backdrop" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`delete-report-title-${reportId}`}
        className="confirm-modal-body"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="confirm-modal-close" type="button" aria-label="ปิด" onClick={() => setIsOpen(false)}>
          <X size={18} />
        </button>
        <div className="confirm-modal-icon danger">
          <AlertTriangle size={26} />
        </div>
        <p className="confirm-modal-eyebrow">ยืนยันการลบรายงาน</p>
        <h2 id={`delete-report-title-${reportId}`}>ลบรายงาน {label}?</h2>
        <p>ข้อมูลสถานะและ metric ในรายงานนี้จะถูกลบออกถาวร กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ</p>
        <div className="confirm-modal-actions">
          <button className="button secondary" type="button" onClick={() => setIsOpen(false)}>ยกเลิก</button>
          <form action={deleteReportAction} style={{ display: "contents" }}>
            <input type="hidden" name="reportId" value={reportId} />
            <button className="button danger confirm-modal-danger" type="submit">
              <Trash2 size={17} /> ยืนยันลบ
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button className="button danger report-delete-trigger" type="button" onClick={() => setIsOpen(true)}>
        <Trash2 size={16} />
        ลบ
      </button>
      {modal}
    </>
  );
}
