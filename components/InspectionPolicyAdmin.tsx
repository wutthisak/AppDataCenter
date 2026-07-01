"use client";

import { useState, useTransition } from "react";
import { PlusCircle, Edit3, ToggleLeft, ToggleRight, X, ClipboardList } from "lucide-react";
import { upsertPolicy, togglePolicy, type PolicyFormData } from "@/app/admin/inspection-policy/actions";

const SHIFT_OPTIONS = [
  { key: "OFFICE_HOURS",     label: "เวลาราชการ" },
  { key: "MORNING_SHIFT",    label: "เวรเช้า" },
  { key: "AFTERNOON_SHIFT",  label: "เวรบ่าย" },
  { key: "NIGHT_SHIFT",      label: "เวรดึก" }
];

const SHIFT_COLOR: Record<string, string> = {
  OFFICE_HOURS:    "#2563eb",
  MORNING_SHIFT:   "#059669",
  AFTERNOON_SHIFT: "#d97706",
  NIGHT_SHIFT:     "#7c3aed"
};

function shiftBadge(shiftStr: string) {
  if (!shiftStr || shiftStr === "ALL") {
    return <span style={{ fontSize: 11, fontWeight: 700, background: "#e0e7ff", color: "#4f46e5", padding: "2px 8px", borderRadius: 99 }}>ทุกเวร</span>;
  }
  const keys = shiftStr.split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {keys.map((k) => {
        const opt = SHIFT_OPTIONS.find((o) => o.key === k);
        const col = SHIFT_COLOR[k] ?? "#475569";
        return (
          <span key={k} style={{ fontSize: 11, fontWeight: 700, background: `${col}18`, color: col, padding: "2px 8px", borderRadius: 99, border: `1px solid ${col}33` }}>
            {opt?.label ?? k}
          </span>
        );
      })}
    </span>
  );
}

type Policy = {
  id: string;
  categoryKey: string;
  categoryLabel: string;
  minRoundsPerDay: number;
  requiredShifts: string;
  active: boolean;
  note: string | null;
  displayOrder: number;
};

const EMPTY_FORM: PolicyFormData = {
  categoryKey: "", categoryLabel: "", minRoundsPerDay: 1,
  requiredShifts: "ALL", active: true, note: "", displayOrder: 0
};

export function InspectionPolicyAdmin({ initialPolicies }: { initialPolicies: Policy[] }) {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [form, setForm] = useState<PolicyFormData>(EMPTY_FORM);
  const [shiftAll, setShiftAll] = useState(true);
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShiftAll(true);
    setSelectedShifts([]);
    setError("");
    setShowModal(true);
  }

  function openEdit(p: Policy) {
    setEditing(p);
    const isAll = !p.requiredShifts || p.requiredShifts === "ALL";
    setShiftAll(isAll);
    setSelectedShifts(isAll ? [] : p.requiredShifts.split(",").map((s) => s.trim()));
    setForm({
      id:              p.id,
      categoryKey:     p.categoryKey,
      categoryLabel:   p.categoryLabel,
      minRoundsPerDay: p.minRoundsPerDay,
      requiredShifts:  p.requiredShifts,
      active:          p.active,
      note:            p.note ?? "",
      displayOrder:    p.displayOrder
    });
    setError("");
    setShowModal(true);
  }

  function toggleShiftKey(key: string) {
    setSelectedShifts((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleSubmit() {
    const finalShifts = shiftAll ? "ALL" : selectedShifts.join(",");
    if (!shiftAll && selectedShifts.length === 0) {
      setError("กรุณาเลือกอย่างน้อย 1 เวร หรือเลือก 'ทุกเวร'");
      return;
    }
    const payload: PolicyFormData = { ...form, requiredShifts: finalShifts };
    startTransition(async () => {
      const result = await upsertPolicy(payload);
      if (result?.error) { setError(result.error); return; }
      setShowModal(false);
      window.location.reload();
    });
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      await togglePolicy(id, !current);
      setPolicies((prev) => prev.map((p) => p.id === id ? { ...p, active: !current } : p));
    });
  }

  return (
    <div style={{ padding: "20px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#e0e7ff", color: "#4f46e5", padding: "3px 12px", borderRadius: 99, fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
            <ClipboardList size={13} /> นโยบายการตรวจ
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>กำหนดจำนวนรอบขั้นต่ำและเวรที่ต้องตรวจสำหรับแต่ละหมวดงาน</p>
        </div>
        <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, padding: "9px 18px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", cursor: "pointer", boxShadow: "0 2px 8px rgba(79,70,229,0.35)" }}>
          <PlusCircle size={15} /> เพิ่มนโยบาย
        </button>
      </div>

      {/* Table or Empty State */}
      {policies.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "60px 20px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>ยังไม่มีนโยบายการตรวจ</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>กดปุ่มด้านล่างเพื่อเพิ่มนโยบายแรก</div>
          <button onClick={openCreate} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, padding: "9px 20px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", cursor: "pointer" }}>
            <PlusCircle size={15} /> เพิ่มนโยบาย
          </button>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  {["#","Category Key","ชื่อหมวดงาน","รอบขั้นต่ำ/วัน","เวรที่ต้องตรวจ","สถานะ","หมายเหตุ","จัดการ"].map((h) => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "#475569", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {policies.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbfc", opacity: p.active ? 1 : 0.55 }}>
                    <td style={{ padding: "12px 14px", color: "#94a3b8", fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, background: "#f1f5f9", color: "#475569", padding: "3px 8px", borderRadius: 6, fontFamily: "monospace" }}>{p.categoryKey}</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#1e293b" }}>{p.categoryLabel}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 800, background: "#e0f2fe", color: "#0891b2", padding: "3px 12px", borderRadius: 99 }}>
                        {p.minRoundsPerDay} <span style={{ fontSize: 10, fontWeight: 600 }}>รอบ/วัน</span>
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>{shiftBadge(p.requiredShifts)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: p.active ? "#dcfce7" : "#f1f5f9", color: p.active ? "#059669" : "#94a3b8", padding: "3px 10px", borderRadius: 99 }}>
                        {p.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#64748b", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{p.note || "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEdit(p)} title="แก้ไข" style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#4f46e5", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}>
                          <Edit3 size={13} /> แก้ไข
                        </button>
                        <button onClick={() => handleToggle(p.id, p.active)} disabled={isPending} title={p.active ? "ปิดใช้งาน" : "เปิดใช้งาน"} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e2e8f0", background: p.active ? "#fff5f5" : "#f0fdf4", color: p.active ? "#dc2626" : "#059669", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}>
                          {p.active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                          {p.active ? "ปิด" : "เปิด"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px 16px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>
                {editing ? "✏️ แก้ไขนโยบาย" : "➕ เพิ่มนโยบายใหม่"}
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {error && (
                <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>⚠ {error}</div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Category Key *</label>
                  <input
                    value={form.categoryKey}
                    onChange={(e) => setForm((f) => ({ ...f, categoryKey: e.target.value }))}
                    disabled={!!editing}
                    placeholder="เช่น VM, SERVER"
                    style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: editing ? "#f8fafc" : "#fff", color: "#1e293b", fontWeight: 600, boxSizing: "border-box", fontFamily: "monospace" }}
                  />
                  {editing && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>ไม่สามารถเปลี่ยน Key ได้</div>}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>ชื่อหมวดงาน *</label>
                  <input
                    value={form.categoryLabel}
                    onChange={(e) => setForm((f) => ({ ...f, categoryLabel: e.target.value }))}
                    placeholder="เช่น VM Host"
                    style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#fff", color: "#1e293b", fontWeight: 600, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#0891b2", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>รอบขั้นต่ำ/วัน *</label>
                  <input
                    type="number" min={1} max={24}
                    value={form.minRoundsPerDay}
                    onChange={(e) => setForm((f) => ({ ...f, minRoundsPerDay: Number(e.target.value) }))}
                    style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#fff", color: "#1e293b", fontWeight: 700, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#0891b2", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>ลำดับแสดง</label>
                  <input
                    type="number" min={0}
                    value={form.displayOrder}
                    onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))}
                    style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#fff", color: "#1e293b", fontWeight: 600, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>เวรที่ต้องตรวจ *</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setShiftAll(true); setSelectedShifts([]); }}
                    style={{ padding: "6px 14px", borderRadius: 8, border: `2px solid ${shiftAll ? "#4f46e5" : "#e2e8f0"}`, background: shiftAll ? "#e0e7ff" : "#f8fafc", color: shiftAll ? "#4f46e5" : "#64748b", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                  >
                    ทุกเวร
                  </button>
                  {SHIFT_OPTIONS.map((opt) => {
                    const active = !shiftAll && selectedShifts.includes(opt.key);
                    const col = SHIFT_COLOR[opt.key];
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => { setShiftAll(false); toggleShiftKey(opt.key); }}
                        style={{ padding: "6px 14px", borderRadius: 8, border: `2px solid ${active ? col : "#e2e8f0"}`, background: active ? `${col}18` : "#f8fafc", color: active ? col : "#64748b", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>หมายเหตุ</label>
                <textarea
                  value={form.note ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  rows={2}
                  placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
                  style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "2px solid #e2e8f0", background: "#fff", color: "#1e293b", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>สถานะ</label>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                  style={{ padding: "6px 16px", borderRadius: 8, border: `2px solid ${form.active ? "#059669" : "#e2e8f0"}`, background: form.active ? "#dcfce7" : "#f1f5f9", color: form.active ? "#059669" : "#94a3b8", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                >
                  {form.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {form.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px 20px", borderTop: "1px solid #f1f5f9" }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "9px 20px", borderRadius: 9, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                ยกเลิก
              </button>
              <button onClick={handleSubmit} disabled={isPending} style={{ padding: "9px 24px", borderRadius: 9, border: "none", background: isPending ? "#e2e8f0" : "linear-gradient(135deg,#4f46e5,#7c3aed)", color: isPending ? "#94a3b8" : "#fff", fontWeight: 700, fontSize: 13, cursor: isPending ? "not-allowed" : "pointer", boxShadow: isPending ? "none" : "0 2px 8px rgba(79,70,229,0.35)" }}>
                {isPending ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "บันทึกนโยบาย"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
