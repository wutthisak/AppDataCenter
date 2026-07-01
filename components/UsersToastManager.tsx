"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Toast } from "@/components/Toast";

export function UsersToastManager() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);

  const clearParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    const changed = params.has("updated") || params.has("error");
    params.delete("updated");
    params.delete("error");
    if (changed) {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  useEffect(() => {
    const updated = searchParams.get("updated");
    const error = searchParams.get("error");

    if (updated) {
      const updatedMap: Record<string, string> = {
        create: "เพิ่มผู้ใช้เรียบร้อยแล้ว",
        user: "อัปเดตข้อมูลผู้ใช้เรียบร้อยแล้ว",
        reset: "รีเซ็ตรหัสผ่านเรียบร้อยแล้ว",
        deleted: "ลบผู้ใช้เรียบร้อยแล้ว",
        activated: "เปิดใช้งานบัญชีเรียบร้อยแล้ว",
        deactivated: "ปิดใช้งานบัญชีเรียบร้อยแล้ว",
      };
      setMessage(updatedMap[updated] ?? "ดำเนินการเรียบร้อยแล้ว");
      setVisible(true);
    } else if (error) {
      const errorMap: Record<string, string> = {
        invalid: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง",
        self: "ไม่สามารถปิดใช้งานหรือลบบัญชีตัวเองได้",
        "self-reset": "ไม่สามารถรีเซ็ตรหัสผ่านตัวเองจากหน้านี้ได้",
      };
      setMessage(errorMap[error] ?? "ไม่สามารถดำเนินการได้");
      setVisible(true);
    }
  }, [searchParams]);

  const handleClose = useCallback(() => {
    setVisible(false);
    clearParams();
  }, [clearParams]);

  if (!visible) return null;

  const isError = searchParams.has("error");

  return (
    <Toast message={message} variant={isError ? "error" : "success"} onClose={handleClose} />
  );
}