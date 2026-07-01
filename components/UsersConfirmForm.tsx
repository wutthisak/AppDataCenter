"use client";

import type { FormEvent, FormHTMLAttributes, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, X } from "lucide-react";

type ConfirmTone = "primary" | "success" | "warning" | "danger";

type UsersConfirmFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  confirmTitle: string;
  confirmDescription: string;
  confirmButtonLabel: string;
  confirmTone?: ConfirmTone;
  cancelLabel?: string;
};

const toneIcon = {
  primary: ShieldCheck,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertTriangle
};

export function UsersConfirmForm({
  action,
  children,
  confirmTitle,
  confirmDescription,
  confirmButtonLabel,
  confirmTone = "primary",
  cancelLabel = "ยกเลิก",
  ...formProps
}: UsersConfirmFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const allowSubmitRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const Icon = toneIcon[confirmTone];

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (allowSubmitRef.current) return;

    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setOpen(true);
  }

  function handleConfirm() {
    allowSubmitRef.current = true;
    setSubmitting(true);
    setOpen(false);
    formRef.current?.requestSubmit();
  }

  function handleCancel() {
    setOpen(false);
  }

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit} {...formProps}>
      {children}

      {open ? (
        <div className="users-confirm-backdrop">
          <div
            className={`users-confirm-dialog users-confirm-dialog--${confirmTone}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            <button type="button" className="users-confirm-close" onClick={handleCancel} aria-label="ปิดหน้าต่างยืนยัน">
              <X size={18} />
            </button>
            <div className="users-confirm-icon">
              <Icon size={28} />
            </div>
            <div className="users-confirm-copy">
              <h3 id={titleId}>{confirmTitle}</h3>
              <p id={descriptionId}>{confirmDescription}</p>
            </div>
            <div className="users-confirm-actions">
              <button type="button" className="button secondary" onClick={handleCancel}>
                {cancelLabel}
              </button>
              <button type="button" className={`button ${confirmTone === "danger" ? "danger" : ""}`} onClick={handleConfirm} disabled={submitting}>
                {submitting ? "กำลังดำเนินการ..." : confirmButtonLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
