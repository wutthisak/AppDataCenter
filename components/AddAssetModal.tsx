"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Server, ChevronRight, ChevronLeft, Save, CheckCircle } from "lucide-react";
import { addAssetActionClient } from "@/app/actions";

export type ModalField =
  | { kind: "text"; name: string; label: string; placeholder: string; required?: boolean }
  | { kind: "number-unit"; name: string; label: string; placeholder: string; required?: boolean; units: { value: string; label: string }[] }
  | { kind: "select"; name: string; label: string; placeholder: string; required?: boolean; options: string[] };

export type ModalStep = { label: string; fields: ModalField[] };

export function AddAssetModal({
  categoryId,
  returnTo,
  steps,
  ipPlaceholder,
}: {
  categoryId: string;
  returnTo: string;
  steps: ModalStep[];
  ipPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const totalSteps = steps.length + 1; // step 0 = name+IP, rest = steps[]

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    setStepIdx(0);
    setSuccess(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handleNext() {
    if (stepIdx === 0) {
      const nameInput = formRef.current?.querySelector<HTMLInputElement>('[name="name"]');
      const ipInput = formRef.current?.querySelector<HTMLInputElement>('[name="ipAddress"]');
      if (nameInput && !nameInput.value.trim()) { nameInput.focus(); return; }
      if (ipInput && !ipInput.value.trim()) { ipInput.focus(); return; }
    }
    setStepIdx((s) => s + 1);
  }

  function handleSubmit() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    startTransition(async () => {
      const result = await addAssetActionClient(formData);
      if (result.ok) {
        setSuccess(true);
        setTimeout(() => setOpen(false), 1400);
      }
    });
  }

  function renderField(field: ModalField) {
    if (field.kind === "number-unit") return (
      <div className="add-asset-modal-unit-row">
        <input name={`${field.name}Value`} type="number" step="0.01" placeholder={field.placeholder} />
        <select name={`${field.name}Unit`} defaultValue={field.units[0]?.value}>
          {field.units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </div>
    );
    if (field.kind === "select") return (
      <select name={field.name}>
        <option value="">{field.placeholder}</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
    return <input name={field.name} placeholder={field.placeholder} />;
  }

  const isLastStep = stepIdx === totalSteps - 1;

  const modal = open && mounted ? createPortal(
    <div className="add-asset-modal-overlay" onClick={() => !isPending && setOpen(false)}>
      <div className="add-asset-modal" role="dialog" aria-modal="true" aria-labelledby="add-asset-modal-title" onClick={(e) => e.stopPropagation()}>

        <div className="add-asset-modal-header">
          <div className="add-asset-modal-icon"><Server size={22} /></div>
          <div>
            <h2 id="add-asset-modal-title">เพิ่มรายการใหม่</h2>
            <p>{success ? "บันทึกสำเร็จ!" : `ขั้นตอน ${stepIdx + 1} / ${totalSteps}`}</p>
          </div>
          <button className="add-asset-modal-close" type="button" onClick={() => setOpen(false)} disabled={isPending}>
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="add-asset-modal-success">
            <CheckCircle size={48} />
            <p>บันทึกรายการสำเร็จแล้ว</p>
          </div>
        ) : (
          <>
            {/* Step indicator */}
            <div className="add-asset-modal-steps">
              {/* step 0 = ข้อมูลหลัก */}
              <div className={`add-asset-step ${stepIdx >= 0 ? "active" : ""}`}>
                <span>1</span><label>ข้อมูลหลัก</label>
              </div>
              {steps.map((s, i) => (
                <>
                  <div key={`line-${i}`} className="add-asset-step-line" />
                  <div key={`step-${i}`} className={`add-asset-step ${stepIdx >= i + 1 ? "active" : ""}`}>
                    <span>{i + 2}</span><label>{s.label}</label>
                  </div>
                </>
              ))}
            </div>

            <form ref={formRef} className="add-asset-modal-form">
              <input type="hidden" name="categoryId" value={categoryId} />
              <input type="hidden" name="returnTo" value={returnTo} />

              {/* Step 0: name + IP */}
              <div style={{ display: stepIdx === 0 ? "contents" : "none" }}>
                <div className="add-asset-modal-field">
                  <label>ชื่อรายการ <span className="required-star">*</span></label>
                  <input name="name" placeholder="เช่น server-01, esxi-b1" autoFocus={stepIdx === 0} />
                </div>
                <div className="add-asset-modal-field">
                  <label>IP Address <span className="required-star">*</span></label>
                  <input name="ipAddress" placeholder={ipPlaceholder ?? "เช่น 192.168.1.10"} />
                </div>
              </div>

              {/* Dynamic steps */}
              {steps.map((s, i) => (
                <div key={i} style={{ display: stepIdx === i + 1 ? "contents" : "none" }}>
                  {s.fields.map((field) => (
                    <div key={field.name} className="add-asset-modal-field">
                      <label>{field.label}{field.required && <span className="required-star"> *</span>}</label>
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              ))}

              <div className="add-asset-modal-actions">
                {stepIdx === 0 ? (
                  <>
                    <button type="button" className="add-asset-modal-btn secondary" onClick={() => setOpen(false)}>ยกเลิก</button>
                    <button type="button" className="add-asset-modal-btn primary" onClick={handleNext}>
                      ถัดไป <ChevronRight size={16} />
                    </button>
                  </>
                ) : isLastStep ? (
                  <>
                    <button type="button" className="add-asset-modal-btn secondary" onClick={() => setStepIdx((s) => s - 1)} disabled={isPending}>
                      <ChevronLeft size={16} /> ย้อนกลับ
                    </button>
                    <button type="button" className="add-asset-modal-btn primary" onClick={handleSubmit} disabled={isPending}>
                      {isPending ? "กำลังบันทึก..." : <><Save size={15} /> บันทึก</>}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="add-asset-modal-btn secondary" onClick={() => setStepIdx((s) => s - 1)} disabled={isPending}>
                      <ChevronLeft size={16} /> ย้อนกลับ
                    </button>
                    <button type="button" className="add-asset-modal-btn primary" onClick={handleNext}>
                      ถัดไป <ChevronRight size={16} />
                    </button>
                  </>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button type="button" className="button add-asset-trigger-btn" onClick={() => setOpen(true)}>
        <Plus size={15} /> เพิ่ม
      </button>
      {modal}
    </>
  );
}
