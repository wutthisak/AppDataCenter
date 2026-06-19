"use client";

import { useEffect, useState, useCallback } from "react";

type ToastVariant = "success" | "error";

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, variant = "success", duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      onClose();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(handleClose, duration);
    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  if (!visible && !closing) return null;

  const bgColor = variant === "success"
    ? "linear-gradient(135deg, #059669, #10b981)"
    : "linear-gradient(135deg, #dc2626, #ef4444)";

  const icon = variant === "success" ? "✓" : "✕";

  return (
    <div
      className={`toast-container ${closing ? "toast-closing" : "toast-open"}`}
      style={{
        position: "fixed",
        top: 24,
        right: 24,
        zIndex: 9999,
        maxWidth: 400,
        minWidth: 280,
        padding: "14px 18px",
        borderRadius: 12,
        background: bgColor,
        color: "#fff",
        boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "var(--font-formal)",
        transform: closing ? "translateX(120%)" : "translateX(0)",
        opacity: closing ? 0 : 1,
        transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.2)",
          fontSize: 16,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>
        {message}
      </span>
      <button
        onClick={handleClose}
        style={{
          background: "rgba(255,255,255,0.15)",
          border: "none",
          borderRadius: "50%",
          width: 28,
          height: 28,
          cursor: "pointer",
          color: "#fff",
          fontSize: 16,
          fontWeight: 700,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.3)")}
        onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
        aria-label="ปิด"
      >
        ✕
      </button>
    </div>
  );
}