"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { updateAssetActionClient } from "@/app/actions";

export function SaveWithToast({ formId }: { formId: string }) {
  const [toast, setToast] = useState<"idle" | "saving" | "done">("idle");
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { setMounted(true); }, []);

  function handleSave() {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const formData = new FormData(form);
    startTransition(async () => {
      setToast("saving");
      await updateAssetActionClient(formData);
      setToast("done");
      setTimeout(() => setToast("idle"), 1800);
    });
  }

  const toastPortal = mounted && toast !== "idle" ? createPortal(
    <div className="asset-save-toast-overlay">
      <div className={`asset-save-toast ${toast}`}>
        <div className="asset-save-toast-icon">
          {toast === "saving"
            ? <Loader2 size={36} className="spin" />
            : <CheckCircle size={36} />}
        </div>
        <div className="asset-save-toast-text">
          <strong>{toast === "saving" ? "กำลังบันทึก..." : "บันทึกสำเร็จ!"}</strong>
          <span>{toast === "saving" ? "โปรดรอสักครู่" : "ข้อมูลถูกอัปเดตเรียบร้อยแล้ว"}</span>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {toastPortal}
      <button
        className="button asset-action-button asset-action-button--save"
        type="button"
        onClick={handleSave}
        disabled={isPending}
      >
        {isPending ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </>
  );
}
