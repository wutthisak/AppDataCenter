"use client";

import type { FormEvent, MouseEvent } from "react";
import { useEffect, useId, useState } from "react";
import { CheckCircle2, Clock3, Droplets, Save, Thermometer, X } from "lucide-react";

interface ChecklistItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: {
    id: string;
    name: string;
    requiresTemperature: boolean;
    requiresHumidity: boolean;
    estimatedDurationMin: number;
  };
  categoryId: string;
  onSave: (data: { name: string; requiresTemperature: boolean; requiresHumidity: boolean; estimatedDurationMin: number }) => Promise<void> | void;
}

export function ChecklistItemModal({ isOpen, onClose, item, onSave }: ChecklistItemModalProps) {
  const [name, setName] = useState(item?.name || "");
  const [requiresTemperature, setRequiresTemperature] = useState(item?.requiresTemperature || false);
  const [requiresHumidity, setRequiresHumidity] = useState(item?.requiresHumidity || false);
  const [estimatedDurationMin, setEstimatedDurationMin] = useState(item?.estimatedDurationMin ?? 5);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const confirmTitleId = useId();
  const isEditing = Boolean(item);

  useEffect(() => {
    setName(item?.name || "");
    setRequiresTemperature(item?.requiresTemperature || false);
    setRequiresHumidity(item?.requiresHumidity || false);
    setEstimatedDurationMin(item?.estimatedDurationMin ?? 5);
    setConfirmOpen(false);
  }, [item, isOpen]);

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
      await onSave({ name: name.trim(), requiresTemperature, requiresHumidity, estimatedDurationMin });
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
      <div className="cl-modal-dialog cl-modal-dialog--wide" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <div className="cl-modal-header">
          <div>
            <p className="cl-kicker">Checklist Item</p>
            <h2 id={titleId}>{isEditing ? "แก้ไขรายการตรวจสอบ" : "เพิ่มรายการตรวจสอบ"}</h2>
          </div>
          <button type="button" className="cl-icon-button" onClick={onClose} aria-label="ปิดหน้าต่าง">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cl-modal-body">
            <label className="cl-field">
              ชื่อรายการตรวจสอบ
              <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus placeholder="เช่น ตรวจอุณหภูมิหน้า rack" />
            </label>

            <div className="cl-option-grid">
              <label className={`cl-option-card ${requiresTemperature ? "is-selected" : ""}`}>
                <input type="checkbox" checked={requiresTemperature} onChange={(event) => setRequiresTemperature(event.target.checked)} />
                <span><Thermometer size={18} /></span>
                <strong>บันทึกอุณหภูมิ</strong>
              </label>
              <label className={`cl-option-card ${requiresHumidity ? "is-selected" : ""}`}>
                <input type="checkbox" checked={requiresHumidity} onChange={(event) => setRequiresHumidity(event.target.checked)} />
                <span><Droplets size={18} /></span>
                <strong>บันทึกความชื้น</strong>
              </label>
            </div>

            <label className="cl-field">
              <span className="cl-field-label-icon"><Clock3 size={16} /> เวลาโดยประมาณ (นาที)</span>
              <input
                type="number"
                min={1}
                max={480}
                value={estimatedDurationMin}
                onChange={(event) => setEstimatedDurationMin(Math.max(1, parseInt(event.target.value, 10) || 5))}
              />
              <small>ใช้คำนวณ workload โดยประมาณของรายการนี้</small>
            </label>
          </div>

          <div className="cl-modal-footer">
            <button type="button" className="button secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="button">
              <Save size={16} />
              {isEditing ? "บันทึกการแก้ไข" : "สร้างรายการ"}
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
              <h3 id={confirmTitleId}>{isEditing ? "ยืนยันการบันทึกรายการ" : "ยืนยันการสร้างรายการ"}</h3>
              <p>{isEditing ? `ระบบจะอัปเดตรายการ ${item?.name ?? ""}` : "ระบบจะเพิ่มรายการตรวจสอบใหม่ลงในหมวดหมู่ที่เลือก"}</p>
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
