"use client";

import { useFormStatus } from "react-dom";
import { changePasswordAction } from "@/app/actions";
import { Eye, EyeOff, Lock, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="force-password-btn"
      disabled={pending}
    >
      {pending ? (
        <>
          <span className="force-password-spinner" />
          กำลังบันทึก...
        </>
      ) : (
        <>
          <KeyRound size={18} />
          เปลี่ยนรหัสผ่าน
        </>
      )}
    </button>
  );
}

function PasswordInput({
  name,
  placeholder,
  autoComplete,
}: {
  name: string;
  placeholder: string;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="force-password-input-wrap">
      <input
        name={name}
        type={show ? "text" : "password"}
        required
        minLength={8}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="force-password-input"
      />
      <button
        type="button"
        className="force-password-toggle"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function ForcePasswordReset({
  error,
  updated,
}: {
  error?: string;
  updated?: string;
}) {
  return (
    <div className="force-password-page">
      <div className="force-password-card">
        {/* Icon */}
        <div className="force-password-icon">
          <Lock size={32} />
        </div>

        {/* Title */}
        <h1 className="force-password-title">เปลี่ยนรหัสผ่าน</h1>
        <p className="force-password-desc">
          ผู้ดูแลระบบได้ตั้งค่ารหัสผ่านเริ่มต้นให้คุณ กรุณาตั้งรหัสผ่านใหม่
          เพื่อความปลอดภัยก่อนเข้าใช้งานระบบ
        </p>

        {/* Alert */}
        <div className="force-password-alert">
          <ShieldCheck size={18} />
          <span>รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และควรมีทั้งตัวอักษรและตัวเลขเพื่อความปลอดภัย</span>
        </div>

        {/* Error / Success Messages */}
        {error === "invalid" && (
          <div className="force-password-error">
            ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านให้ตรงกันทั้งสองช่อง และรหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร
          </div>
        )}
        {error === "wrong" && (
          <div className="force-password-error">
            รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง
          </div>
        )}
        {updated && (
          <div className="force-password-success">
            เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กำลังนำคุณไปยังหน้าหลัก...
            <meta httpEquiv="refresh" content="1;url=/" />
          </div>
        )}

        {/* Form */}
        {!updated && (
          <form action={changePasswordAction} className="force-password-form">
            <input type="hidden" name="returnTo" value="/profile?forcePassword=1" />

            <div className="force-password-field">
              <label htmlFor="currentPassword">รหัสผ่านปัจจุบัน</label>
              <PasswordInput
                name="currentPassword"
                placeholder="ป้อนรหัสผ่านปัจจุบันของคุณ"
                autoComplete="current-password"
              />
            </div>

            <div className="force-password-field">
              <label htmlFor="newPassword">รหัสผ่านใหม่</label>
              <PasswordInput
                name="newPassword"
                placeholder="ป้อนรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร"
                autoComplete="new-password"
              />
            </div>

            <div className="force-password-field">
              <label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</label>
              <PasswordInput
                name="confirmPassword"
                placeholder="ป้อนรหัสผ่านใหม่อีกครั้ง"
                autoComplete="new-password"
              />
            </div>

            <SubmitButton />
          </form>
        )}
      </div>
    </div>
  );
}