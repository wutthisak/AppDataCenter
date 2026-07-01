"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X, Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  reportId: string;
  month: number;
  buddhistYear: number;
  monthLabel: string;
}

export function ResetReportDataButton({ reportId, month, buddhistYear, monthLabel }: Props) {
  const [isOpen, setIsOpen]     = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !loading) setIsOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, loading]);

  async function handleReset() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/reset-data`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "เกิดข้อผิดพลาด");
      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
        router.refresh();
      }, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
    setError(null);
    setSuccess(false);
  }

  const modal = isOpen && mounted ? createPortal(
    <div className="confirm-modal" role="presentation" onClick={handleClose}>
      <div className="confirm-modal-backdrop" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`reset-report-title-${reportId}`}
        className="confirm-modal-body"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        {!loading && (
          <button className="confirm-modal-close" type="button" aria-label="ปิด" onClick={handleClose}>
            <X size={18} />
          </button>
        )}

        {success ? (
          <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <CheckCircle2 size={48} color="#059669" />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#059669", margin: "0 0 6px" }}>
              ลบข้อมูลเรียบร้อยแล้ว
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              ลบข้อมูลการบันทึกประจำเดือน {monthLabel} เรียบร้อยแล้ว
            </p>
          </div>
        ) : (
          <>
            <div className="confirm-modal-icon danger">
              <AlertTriangle size={26} />
            </div>
            <p className="confirm-modal-eyebrow">⚠ ลบข้อมูลการบันทึกประจำเดือน</p>
            <h2 id={`reset-report-title-${reportId}`} style={{ fontSize: 16, margin: "6px 0 10px" }}>
              ต้องการลบข้อมูลการบันทึกของเดือน<br />
              <span style={{ color: "#dc2626" }}>{month}/{buddhistYear}</span>
            </h2>
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#374151", lineHeight: 1.7
            }}>
              <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#b91c1c" }}>การดำเนินการนี้จะลบ:</p>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#374151" }}>
                <li>Activity Logs / Daily Inspection / Inspection Results</li>
                <li>Server Metric Entries</li>
                <li>Daily Status Entries / Incident Logs</li>
              </ul>
              <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 12 }}>
                จะ<strong>ไม่</strong>ลบ Master Data (Asset, Users, Policy, Config)
              </p>
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", textAlign: "center", margin: "0 0 16px" }}>
              ⚠ ไม่สามารถย้อนกลับได้
            </p>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>
                {error}
              </div>
            )}

            <div className="confirm-modal-actions">
              <button className="button secondary" type="button" onClick={handleClose} disabled={loading}>
                ยกเลิก
              </button>
              <button
                className="button danger confirm-modal-danger"
                type="button"
                onClick={handleReset}
                disabled={loading}
                style={{ minWidth: 110 }}
              >
                {loading ? (
                  <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> กำลังลบ...</>
                ) : (
                  <><Trash2 size={15} /> ลบข้อมูล</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button className="button danger report-delete-trigger" type="button" onClick={() => setIsOpen(true)}>
        <Trash2 size={15} />
        ลบข้อมูล
      </button>
      {modal}
    </>
  );
}
