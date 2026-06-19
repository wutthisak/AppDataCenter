"use client";

import { useState, useCallback } from "react";
import { bulkUpsertServerMetricAction } from "@/app/actions";

type AssetRow = {
  id: string;
  name: string;
  cpu: string | null;
  ram: string | null;
  disk: string | null;
  os: string | null;
  ramTotalGb: number | null;
  diskTotalGb: number | null;
};

type LastMetric = {
  cpuPercent: number;
  ramUsedGb: number;
  diskUsedGb: number;
  diskTotalGb: number;
};

type RowState = {
  cpuPercent: string;
  ramUsedGb: string;
  diskUsedGb: string;
  dirty: boolean;
};

function statusColor(pct: number) {
  if (pct >= 90) return "#dc2626";
  if (pct >= 80) return "#f59e0b";
  return "#059669";
}

function statusLabel(pct: number) {
  if (pct >= 90) return "Critical";
  if (pct >= 80) return "Warning";
  return "Normal";
}

function pctCalc(used: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((used / total) * 100);
}

export function FastEntryForm({
  assets,
  lastMetrics,
  recordDate,
  returnTo,
  categoryCode
}: {
  assets: AssetRow[];
  lastMetrics: Record<string, LastMetric>;
  recordDate: string;
  returnTo: string;
  categoryCode: string;
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const a of assets) {
      const last = lastMetrics[a.id];
      init[a.id] = {
        cpuPercent: last ? String(last.cpuPercent) : "",
        ramUsedGb: last ? String(last.ramUsedGb) : "",
        diskUsedGb: last ? String(last.diskUsedGb) : "",
        dirty: false
      };
    }
    return init;
  });

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const updateField = useCallback((id: string, field: keyof RowState, value: string) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value, dirty: true } }));
  }, []);

  const fillPrevious = useCallback((id: string) => {
    const last = lastMetrics[id];
    if (!last) return;
    setRows((prev) => ({
      ...prev,
      [id]: {
        cpuPercent: String(last.cpuPercent),
        ramUsedGb: String(last.ramUsedGb),
        diskUsedGb: String(last.diskUsedGb),
        dirty: true
      }
    }));
  }, [lastMetrics]);

  const dirtyRows = assets.filter((a) => {
    const r = rows[a.id];
    return r && r.dirty && r.cpuPercent !== "" && r.ramUsedGb !== "" && r.diskUsedGb !== "";
  });

  const handleSubmit = async () => {
    if (dirtyRows.length === 0) return;
    setSaving(true);
    setSavedMsg("");

    const entries = dirtyRows.map((a) => {
      const r = rows[a.id];
      return {
        assetId: a.id,
        cpuPercent: Number(r.cpuPercent),
        ramUsedGb: Number(r.ramUsedGb),
        ramTotalGb: a.ramTotalGb ?? 0,
        disks: a.diskTotalGb ? [{ diskName: "Main", usedGb: Number(r.diskUsedGb), totalGb: a.diskTotalGb }] : []
      };
    });

    const fd = new FormData();
    fd.set("returnTo", returnTo);
    fd.set("recordDate", recordDate);
    fd.set("entries", JSON.stringify(entries));

    try {
      await bulkUpsertServerMetricAction(fd);
    } catch {
      // redirect happens server-side
    }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          {dirtyRows.length > 0 ? (
            <span style={{ color: "#2563eb", fontWeight: 600 }}>{dirtyRows.length} รายการพร้อมบันทึก</span>
          ) : (
            <span>กรอก CPU%, RAM Used, Disk Used แล้วกด บันทึกทั้งหมด</span>
          )}
        </div>
        <button
          className="button"
          type="button"
          disabled={dirtyRows.length === 0 || saving}
          onClick={handleSubmit}
          style={{ minWidth: 160 }}
        >
          {saving ? "กำลังบันทึก..." : `บันทึกทั้งหมด (${dirtyRows.length})`}
        </button>
      </div>

      {savedMsg && <p style={{ color: "#059669", fontSize: 13, marginBottom: 10 }}>{savedMsg}</p>}

      <div className="table-wrap">
        <table style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}>Asset</th>
              <th style={{ width: 70 }}>CPU Core</th>
              <th style={{ width: 80 }}>RAM Total</th>
              <th style={{ width: 80 }}>Disk Total</th>
              <th style={{ width: 90 }}>CPU %</th>
              <th style={{ width: 100 }}>RAM Used (GB)</th>
              <th style={{ width: 100 }}>Disk Used (GB)</th>
              <th style={{ width: 120 }}>Status</th>
              <th style={{ width: 70 }}>ค่าก่อน</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => {
              const r = rows[a.id] ?? { cpuPercent: "", ramUsedGb: "", diskUsedGb: "", dirty: false };
              const last = lastMetrics[a.id];
              const cpuVal = Number(r.cpuPercent);
              const ramUsed = Number(r.ramUsedGb);
              const diskUsed = Number(r.diskUsedGb);
              const ramPct = a.ramTotalGb ? pctCalc(ramUsed, a.ramTotalGb) : 0;
              const diskPct = a.diskTotalGb ? pctCalc(diskUsed, a.diskTotalGb) : 0;
              const hasValues = r.cpuPercent !== "" && r.ramUsedGb !== "" && r.diskUsedGb !== "";
              const worst = hasValues ? Math.max(cpuVal, ramPct, diskPct) : -1;

              return (
                <tr key={a.id} style={{ background: r.dirty ? "#f0f9ff" : undefined }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{a.os ?? ""}</div>
                  </td>
                  <td style={{ textAlign: "center", color: "#6b7280" }}>{a.cpu ?? "-"}</td>
                  <td style={{ textAlign: "center", color: "#6b7280" }}>{a.ram ?? "-"}</td>
                  <td style={{ textAlign: "center", color: "#6b7280" }}>{a.disk ?? "-"}</td>
                  <td>
                    <input
                      type="number" min="0" max="100" step="0.1"
                      value={r.cpuPercent}
                      onChange={(e) => updateField(a.id, "cpuPercent", e.target.value)}
                      style={{ width: "100%", padding: "4px 6px", fontSize: 13, borderRadius: 4, border: "1px solid #d1d5db" }}
                      placeholder={last ? String(last.cpuPercent) : ""}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="0" step="0.1"
                      value={r.ramUsedGb}
                      onChange={(e) => updateField(a.id, "ramUsedGb", e.target.value)}
                      style={{ width: "100%", padding: "4px 6px", fontSize: 13, borderRadius: 4, border: "1px solid #d1d5db" }}
                      placeholder={last ? String(last.ramUsedGb) : ""}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="0" step="0.1"
                      value={r.diskUsedGb}
                      onChange={(e) => updateField(a.id, "diskUsedGb", e.target.value)}
                      style={{ width: "100%", padding: "4px 6px", fontSize: 13, borderRadius: 4, border: "1px solid #d1d5db" }}
                      placeholder={last ? String(last.diskUsedGb) : ""}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {hasValues ? (
                      <span style={{ fontWeight: 700, fontSize: 12, color: statusColor(worst), background: `${statusColor(worst)}15`, padding: "2px 8px", borderRadius: 6 }}>
                        {statusLabel(worst)}
                      </span>
                    ) : (
                      <span style={{ color: "#d1d5db" }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {last ? (
                      <button
                        type="button"
                        onClick={() => fillPrevious(a.id)}
                        style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer" }}
                        title={`CPU ${last.cpuPercent}% / RAM ${last.ramUsedGb}GB / Disk ${last.diskUsedGb}GB`}
                      >
                        ใช้ค่าก่อน
                      </button>
                    ) : (
                      <span style={{ color: "#d1d5db", fontSize: 11 }}>ไม่มี</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
