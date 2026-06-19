"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Toast } from "@/components/Toast";

export function SaveToastManager() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [showToast, setShowToast] = useState(false);
  const [message, setMessage] = useState("");

  const clearParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    const changed = params.has("saved") || params.has("error");
    params.delete("saved");
    params.delete("error");
    if (changed) {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  useEffect(() => {
    const saved = searchParams.get("saved");
    const error = searchParams.get("error");

    if (saved === "1") {
      setMessage("✅ บันทึกสำเร็จแล้ว");
      setShowToast(true);
    } else if (error) {
      const errorMap: Record<string, string> = {
        invalid: "กรุณากรอกข้อมูลให้ครบถ้วน",
        duplicate: "มีค่านี้อยู่แล้วในประเภทเดียวกัน",
        "not-found": "ไม่พบรายการที่ต้องการแก้ไข",
      };
      setMessage(errorMap[error] ?? "ไม่สามารถบันทึกข้อมูลได้");
      setShowToast(true);
    }
  }, [searchParams]);

  const handleClose = useCallback(() => {
    setShowToast(false);
    clearParams();
  }, [clearParams]);

  if (!showToast) return null;

  const isError = searchParams.has("error");

  return (
    <Toast
      message={message}
      variant={isError ? "error" : "success"}
      onClose={handleClose}
    />
  );
}