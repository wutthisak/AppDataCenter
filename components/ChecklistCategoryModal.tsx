"use client";

import type { FormEvent, MouseEvent } from "react";
import { useEffect, useId, useState } from "react";
import { CheckCircle2, ClipboardList, Save, X } from "lucide-react";

interface ChecklistCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: {
    id: string;
    name: string;
    dataCenterId: string;
  };
  dataCenterId: string;
  onSave: (data: { name: string; dataCenterId: string }) => Promise<void> | void;
}

export function ChecklistCategoryModal({ isOpen, onClose, category, dataCenterId, onSave }: ChecklistCategoryModalProps) {
  const [name, setName] = useState(category?.name || "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const confirmTitleId = useId();
  const isEditing = Boolean(category);

  useEffect(() => {
    setName(category?.name || "");
    setConfirmOpen(false);
  }, [category, isOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (confirmOpen) {
          setConfirmOpen(false);
          return;
        }
        onClose();
      }
    }

    if (!isOpen) return;
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [confirmOpen, isOpen, onClose]);

  if (!isOpen) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setConfirmOpen(true);
  }

  async function handleConfirmSave() {
    setSaving(true);
    try {
      await onSave({ name: name.trim(), dataCenterId });
      setConfirmOpen(false);
    } catch {
      // Visible error notice is handled by the parent.
    } finally {
      setSaving(false);
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="cl-modal-overlay" onClick={handleBackdropClick}>
      <div className="cl-modal-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <div className="cl-modal-header">
          <div>
            <p className="cl-kicker">Checklist Category</p>
            <h2 id={titleId}>{isEditing ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่ใหม่"}</h2>
          </div>
          <button type="button" className="cl-icon-button" onClick={onClose} aria-label="ปิดหน้าต่าง">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cl-modal-body">
            <div className="cl-modal-hero">
              <div className="cl-modal-mark"><ClipboardList size={24} /></div>
              <div>
                <div className="cl-modal-title">{isEditing ? category?.name : "ข้อมูลหมวดหมู่ Checklist"}</div>
                <div className="cl-modal-subtitle">ใช้จัดกลุ่มรายการตรวจสอบให้ทีมเลือกทำงานได้เร็วขึ้น</div>
              </div>
            </div>

            <label className="cl-field">
              ชื่อหมวดหมู่
              <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus placeholder="เช่น ระบบไฟฟ้า / ระบบปรับอากาศ" />
            </label>
          </div>

          <div className="cl-modal-footer">
            <button type="button" className="button secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="button">
              <Save size={16} />
              {isEditing ? "บันทึกการแก้ไข" : "สร้างหมวดหมู่"}
            </button>
          </div>
        </form>

        {confirmOpen ? (
          <div className="cl-confirm-backdrop">
            <div className="cl-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={confirmTitleId}>
              <button type="button" className="cl-confirm-close" onClick={() => setConfirmOpen(false)} aria-label="ปิดหน้าต่างยืนยัน">
                <X size={17} />
              </button>
              <div className="cl-confirm-icon cl-confirm-icon--success"><CheckCircle2 size={28} /></div>
              <h3 id={confirmTitleId}>{isEditing ? "ยืนยันการบันทึกหมวดหมู่" : "ยืนยันการสร้างหมวดหมู่"}</h3>
              <p>{isEditing ? `ระบบจะอัปเดตหมวดหมู่ ${category?.name ?? ""}` : "ระบบจะเพิ่มหมวดหมู่ใหม่ให้ Data Center ที่เลือกอยู่"}</p>
              <div className="cl-confirm-actions">
                <button type="button" className="button secondary" onClick={() => setConfirmOpen(false)} disabled={saving}>ยกเลิก</button>
                <button type="button" className="button" onClick={handleConfirmSave} disabled={saving}>
                  {saving ? "กำลังบันทึก..." : "ยืนยันบันทึก"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
