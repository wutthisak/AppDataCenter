"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteAssetAction } from "@/app/actions";

export function DeleteAssetButton({
  assetId,
  assetName,
  returnTo
}: {
  assetId: string;
  assetName: string;
  returnTo: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
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
        aria-labelledby={`delete-asset-title-${assetId}`}
        className="confirm-modal-body"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="confirm-modal-close" type="button" aria-label="ปิด" onClick={() => setIsOpen(false)}>
          <X size={18} />
        </button>
        <div className="confirm-modal-icon danger">
          <AlertTriangle size={26} />
        </div>
        <p className="confirm-modal-eyebrow">ยืนยันการลบทรัพย์สิน</p>
        <h2 id={`delete-asset-title-${assetId}`}>ลบ {assetName}?</h2>
        <p>รายการทรัพย์สินนี้ รวมถึงข้อมูลสถานะและ metric ที่เกี่ยวข้องจะถูกลบออกถาวร กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ</p>
        <div className="confirm-modal-actions">
          <button className="button secondary" type="button" onClick={() => setIsOpen(false)}>ยกเลิก</button>
          <form action={deleteAssetAction} style={{ display: "contents" }}>
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="returnTo" value={returnTo} />
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
