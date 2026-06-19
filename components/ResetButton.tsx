"use client";

import React from "react";

type Props = {
  formId: string;
  className?: string;
  children?: React.ReactNode;
};

export default function ResetButton({ formId, className, children }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (!confirm("คุณต้องการรีเซ็ตข้อมูลของวันที่เลือก? การกระทำนี้ไม่สามารถยกเลิกได้")) return;
        const form = document.getElementById(formId) as HTMLFormElement | null;
        if (form) form.submit();
      }}
    >
      {children ?? "รีเซ็ต"}
    </button>
  );
}
