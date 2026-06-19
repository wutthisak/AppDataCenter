"use client";

import { useState, useEffect } from "react";

interface ChecklistItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: {
    id: string;
    name: string;
    requiresTemperature: boolean;
    requiresHumidity: boolean;
    estimatedDurationMin: number;
  };
  categoryId: string;
  onSave: (data: { name: string; requiresTemperature: boolean; requiresHumidity: boolean; estimatedDurationMin: number }) => void;
}

export function ChecklistItemModal({ isOpen, onClose, item, categoryId, onSave }: ChecklistItemModalProps) {
  const [name, setName] = useState(item?.name || "");
  const [requiresTemperature, setRequiresTemperature] = useState(item?.requiresTemperature || false);
  const [requiresHumidity, setRequiresHumidity] = useState(item?.requiresHumidity || false);
  const [estimatedDurationMin, setEstimatedDurationMin] = useState(item?.estimatedDurationMin ?? 5);

  // Reset form when item changes
  useEffect(() => {
    setName(item?.name || "");
    setRequiresTemperature(item?.requiresTemperature || false);
    setRequiresHumidity(item?.requiresHumidity || false);
    setEstimatedDurationMin(item?.estimatedDurationMin ?? 5);
  }, [item]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, requiresTemperature, requiresHumidity, estimatedDurationMin });
    setName("");
    setRequiresTemperature(false);
    setRequiresHumidity(false);
    setEstimatedDurationMin(5);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#ffffff",
          padding: "2rem",
          borderRadius: "8px",
          maxWidth: "500px",
          width: "100%",
          margin: "1rem",
          position: "relative",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
          border: "1px solid #e5e7eb"
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "0.5rem",
            right: "0.5rem",
            background: "none",
            border: "none",
            fontSize: "2rem",
            cursor: "pointer",
            color: "#374151",
            padding: "0",
            lineHeight: 1,
            width: "2.5rem",
            height: "2.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px"
          }}
        >
          ×
        </button>
        <h2 style={{ marginBottom: "1.5rem", marginTop: "0.5rem", color: "#111827" }}>
          {item ? "แก้ไขรายการตรวจสอบ" : "เพิ่มรายการตรวจสอบใหม่"}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold", color: "#374151" }}>
              ชื่อรายการ
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor: "#ffffff",
                  color: "#111827",
                  fontSize: "1rem",
                  marginTop: "0.25rem"
                }}
              />
            </label>
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "bold", color: "#374151" }}>
              <input
                type="checkbox"
                checked={requiresTemperature}
                onChange={(e) => setRequiresTemperature(e.target.checked)}
                style={{ width: "1rem", height: "1rem" }}
              />
              บันทึกอุณหภูมิ
            </label>
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "bold", color: "#374151" }}>
              <input
                type="checkbox"
                checked={requiresHumidity}
                onChange={(e) => setRequiresHumidity(e.target.checked)}
                style={{ width: "1rem", height: "1rem" }}
              />
              บันทึกความชื้น
            </label>
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold", color: "#374151" }}>
              เวลาโดยประมาณ (นาที)
              <input
                type="number"
                min={1}
                max={480}
                value={estimatedDurationMin}
                onChange={(e) => setEstimatedDurationMin(Math.max(1, parseInt(e.target.value) || 5))}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor: "#ffffff",
                  color: "#111827",
                  fontSize: "1rem",
                  marginTop: "0.25rem"
                }}
              />
            </label>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#6b7280" }}>ค่าเริ่มต้น 5 นาที — ใช้คำนวณ Estimated Workload เท่านั้น</p>
          </div>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.5rem 1rem",
                cursor: "pointer",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                backgroundColor: "#ffffff",
                color: "#374151"
              }}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              style={{
                padding: "0.5rem 1rem",
                cursor: "pointer",
                border: "none",
                borderRadius: "4px",
                backgroundColor: "#2563eb",
                color: "#ffffff"
              }}
            >
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
