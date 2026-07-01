"use client";

import { useState, useRef } from "react";
import { Trash2, AlertTriangle, ShieldAlert, CheckCircle, XCircle } from "lucide-react";

const CONFIRM_PHRASE = "DELETE INSPECTION DATA";

type ClearResult = {
  activityLogs: number;
  inspectionResults: number;
  dailyInspections: number;
  serverMetricEntries: number;
  serverMetricLogs: number;
  incidentLogs: number;
  dailyStatusEntries: number;
};

export function ClearInspectionDataPanel() {
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [result, setResult] = useState<ClearResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canConfirm = confirmText === CONFIRM_PHRASE && !loading;

  function openModal() {
    setConfirmText("");
    setResult(null);
    setShowModal(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function closeModal() {
    if (loading) return;
    setShowModal(false);
    setConfirmText("");
  }

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 6000);
  }

  async function handleClear() {
    if (!canConfirm) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/maintenance/clear-inspection-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setResult(data.counts as ClearResult);
        setShowModal(false);
        showToast("success", "ล้างข้อมูลการตรวจทั้งหมดเรียบร้อยแล้ว");
      } else {
        showToast("error", `เกิดข้อผิดพลาด: ${data.error ?? "unknown"}`);
      }
    } catch {
      showToast("error", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  const tableRows: { label: string; key: keyof ClearResult }[] = [
    { label: "ผลตรวจสถานะรายวัน (VM/Server/Network/Database)", key: "dailyStatusEntries" },
    { label: "Log ตรวจ DC Room (DailyInspection)", key: "dailyInspections" },
    { label: "ผลตรวจ DC Room (InspectionResult)", key: "inspectionResults" },
    { label: "Activity Log (DC Room)", key: "activityLogs" },
    { label: "Metric Entry เซิร์ฟเวอร์ (ServerMetricEntry)", key: "serverMetricEntries" },
    { label: "Metric Log เซิร์ฟเวอร์ (ServerMetricLog)", key: "serverMetricLogs" },
    { label: "Incident Log", key: "incidentLogs" },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 0" }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 20px",
            borderRadius: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,.18)",
            background: toast.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: `1.5px solid ${toast.type === "success" ? "#22c55e" : "#ef4444"}`,
            minWidth: 280,
            fontWeight: 600,
            fontSize: 14,
            color: toast.type === "success" ? "#15803d" : "#dc2626",
          }}
        >
          {toast.type === "success" ? <CheckCircle size={20} /> : <XCircle size={20} />}
          {toast.message}
        </div>
      )}

      {/* Header card */}
      <div
        style={{
          background: "#fef2f2",
          border: "1.5px solid #fca5a5",
          borderRadius: 16,
          padding: "22px 24px",
          marginBottom: 24,
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <ShieldAlert size={36} style={{ color: "#dc2626", flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#991b1b", marginBottom: 6 }}>
            ล้างข้อมูลการตรวจทั้งหมด (Pre-Production Reset)
          </div>
          <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.7 }}>
            ฟังก์ชันนี้จะ<strong>ลบข้อมูลผลการตรวจสอบทั้งหมด</strong>ที่สร้างจากการทดสอบระบบ
            เพื่อเตรียมความพร้อมก่อนนำระบบขึ้นใช้งานจริง
            <br />
            <strong style={{ color: "#dc2626" }}>การลบนี้ไม่สามารถย้อนกลับได้</strong> —
            Master Data, User, Policy และ Backup Job จะไม่ถูกกระทบ
          </div>
        </div>
      </div>

      {/* What will be deleted */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          padding: "18px 22px",
          marginBottom: 24,
          boxShadow: "0 2px 8px rgba(0,0,0,.04)",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 12 }}>
          ข้อมูลที่จะถูกลบ
        </div>
        <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13, color: "#374151", lineHeight: 1.9 }}>
          <li>ผลการตรวจสถานะรายวัน VM Host / Host Server / Network Device / Database</li>
          <li>Log การตรวจ DC Room / Environment และผลการตรวจ Checklist</li>
          <li>Activity Log ที่เกิดจากการตรวจ DC Room</li>
          <li>ข้อมูล Server Metric (CPU/RAM/Disk) ทั้งหมด</li>
          <li>Incident Log ทั้งหมด</li>
        </ul>
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "#f0fdf4",
            borderRadius: 8,
            border: "1px solid #bbf7d0",
            fontSize: 12,
            color: "#15803d",
            lineHeight: 1.7,
          }}
        >
          <strong>ข้อมูลที่ปลอดภัย (จะไม่ถูกลบ):</strong> User · Role · Asset Master (VM/Server/Network/Database) ·
          Backup Job &amp; Items · Data Center · Checklist Template · Inspection Policy · Monthly Report header ·
          System Settings · Audit Log
        </div>
      </div>

      {/* Result summary after clear */}
      {result && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1.5px solid #86efac",
            borderRadius: 14,
            padding: "16px 22px",
            marginBottom: 24,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, color: "#15803d", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle size={16} /> สรุปข้อมูลที่ถูกลบ
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
            {tableRows.map((r) => (
              <div key={r.key} style={{ fontSize: 12, color: "#374151", display: "flex", justifyContent: "space-between" }}>
                <span>{r.label}</span>
                <strong style={{ color: "#15803d" }}>{result[r.key].toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={openModal}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "13px 28px",
          background: "linear-gradient(135deg,#dc2626,#b91c1c)",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontWeight: 800,
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(220,38,38,.35)",
          transition: "transform .15s",
        }}
      >
        <Trash2 size={18} />
        ล้างข้อมูลการตรวจทั้งหมด
      </button>

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,.55)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-inspection-data-title"
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: "32px 32px 28px",
              maxWidth: 480,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,.3)",
              border: "1.5px solid #fca5a5",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#fef2f2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} style={{ color: "#dc2626" }} />
              </div>
              <div>
                <div id="clear-inspection-data-title" style={{ fontWeight: 800, fontSize: 16, color: "#1e293b" }}>
                  ยืนยันการล้างข้อมูลการตรวจ
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  การดำเนินการนี้ไม่สามารถย้อนกลับได้
                </div>
              </div>
            </div>

            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: 13,
                color: "#991b1b",
                marginBottom: 22,
                lineHeight: 1.6,
              }}
            >
              <AlertTriangle size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              <strong>คำเตือน:</strong> การลบนี้ไม่สามารถย้อนกลับได้ ข้อมูลผลการตรวจทั้งหมดจะหายไปอย่างถาวร
              ระบบจะบันทึก Audit Log ก่อนดำเนินการ
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                พิมพ์ข้อความด้านล่างเพื่อยืนยัน:
              </label>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#dc2626",
                  background: "#fef2f2",
                  padding: "8px 12px",
                  borderRadius: 6,
                  letterSpacing: "0.05em",
                  marginBottom: 10,
                  userSelect: "all",
                }}
              >
                {CONFIRM_PHRASE}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={`พิมพ์: ${CONFIRM_PHRASE}`}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1.5px solid ${confirmText === CONFIRM_PHRASE ? "#22c55e" : confirmText.length > 0 ? "#fca5a5" : "#cbd5e1"}`,
                  fontSize: 13,
                  fontFamily: "monospace",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color .2s",
                  background: confirmText === CONFIRM_PHRASE ? "#f0fdf4" : "#fff",
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && canConfirm) handleClear(); }}
              />
              {confirmText.length > 0 && confirmText !== CONFIRM_PHRASE && (
                <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                  ข้อความไม่ถูกต้อง
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={closeModal}
                disabled={loading}
                style={{
                  padding: "10px 22px",
                  borderRadius: 8,
                  border: "1.5px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#374151",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleClear}
                disabled={!canConfirm}
                style={{
                  padding: "10px 22px",
                  borderRadius: 8,
                  border: "none",
                  background: canConfirm
                    ? "linear-gradient(135deg,#dc2626,#b91c1c)"
                    : "#e5e7eb",
                  color: canConfirm ? "#fff" : "#9ca3af",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: canConfirm ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "background .2s",
                  boxShadow: canConfirm ? "0 4px 12px rgba(220,38,38,.3)" : "none",
                }}
              >
                {loading ? (
                  <>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid rgba(255,255,255,.4)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    กำลังลบ...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    ยืนยันล้างข้อมูล
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
