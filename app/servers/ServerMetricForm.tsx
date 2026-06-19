"use client";

import { useMemo, useState } from "react";
import { addServerMetricAction } from "@/app/actions";

type ServerOption = {
  id: string;
  name: string;
  ram: string | null;
  disk: string | null;
  ramTotalGb: number | null;
  diskTotalGb: number | null;
};

function formatGb(value: number | null) {
  if (value === null) return "";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

type LastMetric = { ramUsedGb: number; diskUsedGb: number; cpuPercent: number };

export function ServerMetricForm({
  reportId,
  returnTo,
  categoryLabel,
  servers,
  lastMetrics = {}
}: {
  reportId: string;
  returnTo: string;
  categoryLabel: string;
  servers: ServerOption[];
  lastMetrics?: Record<string, LastMetric>;
}) {
  const firstId = servers[0]?.id ?? "";
  const firstLast = lastMetrics[firstId];
  const [selectedId, setSelectedId] = useState(firstId);
  const [cpuPercent, setCpuPercent] = useState(firstLast ? String(firstLast.cpuPercent) : "");
  const [ramUsedGb, setRamUsedGb] = useState(firstLast ? String(firstLast.ramUsedGb) : "");
  const [diskUsedGb, setDiskUsedGb] = useState(firstLast ? String(firstLast.diskUsedGb) : "");
  const [note, setNote] = useState("");
  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedId) ?? servers[0] ?? null,
    [selectedId, servers]
  );
  const hasServers = servers.length > 0;
  const hasTotals = Boolean(selectedServer?.ramTotalGb && selectedServer?.diskTotalGb);
  const resetUsageFields = (newId?: string) => {
    const last = newId ? lastMetrics[newId] : undefined;
    setCpuPercent(last ? String(last.cpuPercent) : "");
    setRamUsedGb(last ? String(last.ramUsedGb) : "");
    setDiskUsedGb(last ? String(last.diskUsedGb) : "");
    setNote("");
  };

  return (
    <form className="metric-form" action={addServerMetricAction}>
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="field-wide">
        {categoryLabel}
        <select
          name="serverAssetId"
          value={selectedId}
          onChange={(event) => {
            const newId = event.currentTarget.value;
            setSelectedId(newId);
            resetUsageFields(newId);
          }}
          required
          disabled={!hasServers}
        >
          {servers.map((server) => (
            <option key={server.id} value={server.id}>{server.name}</option>
          ))}
        </select>
      </label>
      <label>
        วันที่วัด
        <input name="measuredAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} required />
      </label>
      <label>
        CPU %
        <input
          name="cpuPercent"
          type="number"
          min="0"
          max="100"
          step="0.01"
          placeholder="0-100"
          value={cpuPercent}
          onChange={(event) => setCpuPercent(event.currentTarget.value)}
          required
        />
      </label>
      <label>
        RAM ใช้ (GB)
        {lastMetrics[selectedId] ? (
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>
            ครั้งก่อน: {lastMetrics[selectedId].ramUsedGb} GB
          </span>
        ) : null}
        <input
          name="ramUsedGb"
          type="number"
          min="0"
          step="0.01"
          placeholder="Used"
          value={ramUsedGb}
          onChange={(event) => setRamUsedGb(event.currentTarget.value)}
          required
        />
      </label>
      <label>
        RAM รวม (GB)
        <input value={formatGb(selectedServer?.ramTotalGb ?? null)} readOnly placeholder="จากบัญชีทรัพย์สิน" />
      </label>
      <label>
        Disk ใช้ (GB)
        {lastMetrics[selectedId] ? (
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>
            ครั้งก่อน: {lastMetrics[selectedId].diskUsedGb} GB
          </span>
        ) : null}
        <input
          name="diskUsedGb"
          type="number"
          min="0"
          step="0.01"
          placeholder="Used"
          value={diskUsedGb}
          onChange={(event) => setDiskUsedGb(event.currentTarget.value)}
          required
        />
      </label>
      <label>
        Disk รวม (GB)
        <input value={formatGb(selectedServer?.diskTotalGb ?? null)} readOnly placeholder="จากบัญชีทรัพย์สิน" />
      </label>
      <label className="field-wide">
        รายละเอียด
        <input
          name="note"
          placeholder="เช่น disk โตจาก log หรือ backup"
          value={note}
          onChange={(event) => setNote(event.currentTarget.value)}
        />
      </label>

      {selectedServer && !hasTotals ? (
        <p className="form-error field-wide">
          กรุณาแก้ข้อมูล RAM และ DISK ของ {selectedServer.name} ในหน้าบัญชีทรัพย์สินก่อนบันทึก Metrics
        </p>
      ) : null}
      {!hasServers ? (
        <p className="form-error field-wide">ยังไม่มีรายการที่เปิดใช้งานสำหรับบันทึก Metrics</p>
      ) : null}

      <div className="form-actions">
        <button className="button" type="submit" disabled={!hasServers || !hasTotals}>บันทึก</button>
      </div>
    </form>
  );
}
