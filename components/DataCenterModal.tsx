"use client";

import type { FormEvent, MouseEvent } from "react";
import { useEffect, useId, useState } from "react";
import { Building2, CheckCircle2, MapPin, Save, X } from "lucide-react";

interface DataCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataCenter?: {
    id: string;
    name: string;
    location: string | null;
    description: string | null;
  };
  onSave: (data: { name: string; location: string; description: string }) => Promise<void> | void;
}

export function DataCenterModal({ isOpen, onClose, dataCenter, onSave }: DataCenterModalProps) {
  const [name, setName] = useState(dataCenter?.name || "");
  const [location, setLocation] = useState(dataCenter?.location || "");
  const [description, setDescription] = useState(dataCenter?.description || "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const confirmTitleId = useId();

  useEffect(() => {
    setName(dataCenter?.name || "");
    setLocation(dataCenter?.location || "");
    setDescription(dataCenter?.description || "");
    setConfirmOpen(false);
    setSaving(false);
  }, [dataCenter, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (confirmOpen) setConfirmOpen(false);
        else onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [confirmOpen, isOpen, onClose]);

  if (!isOpen) return null;

  const isEditing = Boolean(dataCenter);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setConfirmOpen(true);
  }

  async function handleConfirmSave() {
    setSaving(true);
    try {
      await onSave({ name: name.trim(), location: location.trim(), description: description.trim() });
      setConfirmOpen(false);
    } catch {
      // Parent component shows the visible error notice.
    } finally {
      setSaving(false);
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="dc-modal-overlay" onMouseDown={handleBackdropClick}>
      <div className="dc-modal-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
        <div className="dc-modal-header">
          <div>
            <p className="dc-kicker">{isEditing ? "Edit Data Center" : "New Data Center"}</p>
            <h2 id={titleId}>
              <Building2 size={20} />
              {isEditing ? "แก้ไข Data Center" : "เพิ่ม Data Center ใหม่"}
            </h2>
          </div>
          <button type="button" className="dc-icon-button" onClick={onClose} aria-label="ปิด">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dc-modal-body">
            <div className="dc-modal-hero">
              <div className="dc-modal-mark"><MapPin size={24} /></div>
              <div>
                <div className="dc-modal-title">{isEditing ? dataCenter?.name : "ข้อมูลห้อง Data Center"}</div>
                <div className="dc-modal-subtitle">ระบุชื่อ สถานที่ และรายละเอียดที่ใช้ในหน้าตรวจสอบประจำวัน</div>
              </div>
            </div>

            <div className="dc-modal-grid">
              <label>
                ชื่อ Data Center
                <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus placeholder="เช่น DC Site A" />
              </label>
              <label>
                สถานที่
                <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="อาคาร / ชั้น / ห้อง" />
              </label>
              <label className="dc-field-wide">
                คำอธิบาย
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="รายละเอียดเพิ่มเติมของห้อง Data Center" />
              </label>
            </div>
          </div>

          <div className="dc-modal-footer">
            <button type="button" className="button secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="button">
              <Save size={16} />
              {isEditing ? "บันทึกการแก้ไข" : "สร้าง Data Center"}
            </button>
          </div>
        </form>

        {confirmOpen ? (
          <div className="dc-confirm-backdrop">
            <div className="dc-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={confirmTitleId}>
              <button type="button" className="dc-confirm-close" onClick={() => setConfirmOpen(false)} aria-label="ปิดหน้าต่างยืนยัน">
                <X size={17} />
              </button>
              <div className="dc-confirm-icon dc-confirm-icon--success"><CheckCircle2 size={28} /></div>
              <h3 id={confirmTitleId}>{isEditing ? "ยืนยันการบันทึกข้อมูล" : "ยืนยันการสร้าง Data Center"}</h3>
              <p>
                {isEditing
                  ? `ระบบจะอัปเดตข้อมูลของ ${dataCenter?.name ?? "Data Center"} ตามค่าที่กรอกไว้`
                  : "ระบบจะเพิ่ม Data Center ใหม่และนำไปใช้กับงานตรวจสอบประจำวัน"}
              </p>
              <div className="dc-confirm-actions">
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
