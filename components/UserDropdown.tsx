"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, User, Key, Shield, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions";

export function UserDropdown({
  displayName,
  roleLabel,
}: {
  displayName: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="user-dropdown-trigger"
      >
        <span className="user-dropdown-avatar">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="user-dropdown-name">{displayName}</span>
        <ChevronDown size={14} style={{ opacity: 0.6, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div className="user-dropdown-menu">
          <div className="user-dropdown-header">
            <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{displayName}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{roleLabel}</div>
          </div>
          <div className="user-dropdown-divider" />
          <Link href="/profile" className="user-dropdown-item" onClick={() => setOpen(false)}>
            <User size={15} /> โปรไฟล์ของฉัน
          </Link>
          <Link href="/profile" className="user-dropdown-item" onClick={() => setOpen(false)}>
            <Key size={15} /> เปลี่ยนรหัสผ่าน
          </Link>
          <Link href="/security" className="user-dropdown-item" onClick={() => setOpen(false)}>
            <Shield size={15} /> ความปลอดภัย 2FA
          </Link>
          <div className="user-dropdown-divider" />
          <form action={logoutAction} style={{ margin: 0 }}>
            <button type="submit" className="user-dropdown-item user-dropdown-logout">
              <LogOut size={15} /> ออกจากระบบ
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
