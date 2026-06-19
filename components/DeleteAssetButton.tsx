"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <form action={deleteAssetAction}>
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="returnTo" value={returnTo} />
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
            aria-labelledby={`delete-asset-title-${assetId}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="confirm-modal-close" type="button" aria-label="ปิด popup" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>

            <div className="confirm-modal-icon danger">
              <AlertTriangle size={26} />
            </div>

            <div className="confirm-modal-body">
              <p className="confirm-modal-eyebrow">ยืนยันการลบทรัพย์สิน</p>
              <h2 id={`delete-asset-title-${assetId}`}>ลบ {assetName}?</h2>
              <p>
                รายการทรัพย์สินนี้ รวมถึงข้อมูลสถานะและ metric ที่เกี่ยวข้องจะถูกลบออกถาวร กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ
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
