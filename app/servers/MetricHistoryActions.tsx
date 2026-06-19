"use client";

import { useState } from "react";
import { deleteServerMetricAction, updateServerMetricAction } from "@/app/actions";

type ServerOption = {
  id: string;
  name: string;
};

type MetricEditData = {
  id: string;
  serverAssetId: string;
  measuredAt: string;
  cpuPercent: number;
  ramUsedGb: number;
  diskUsedGb: number;
  note: string;
};

export function MetricHistoryActions({
  metric,
  returnTo,
  categoryLabel,
  serverOptions
}: {
  metric: MetricEditData;
  returnTo: string;
  categoryLabel: string;
  serverOptions: ServerOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="metric-history-actions">
      <button className="button secondary" type="button" onClick={() => setIsOpen(true)}>
        แก้ไข
      </button>

      <form action={deleteServerMetricAction}>
        <input type="hidden" name="metricId" value={metric.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button className="button danger" type="submit">ลบ</button>
      </form>

      {isOpen ? (
        <div className="metric-modal-overlay" role="presentation" onClick={() => setIsOpen(false)}>
          <div className="metric-modal" role="dialog" aria-modal="true" aria-labelledby={"metric-edit-title-" + metric.id} onClick={(event) => event.stopPropagation()}>
            <div className="metric-modal-header">
              <div>
                <div className="metric-modal-eyebrow">Edit Server Metric</div>
                <h2 id={"metric-edit-title-" + metric.id}>แก้ไขประวัติการบันทึก</h2>
                <p>ปรับค่า CPU, RAM, Disk และรายละเอียดของรายการนี้</p>
              </div>
              <button className="metric-modal-close" type="button" onClick={() => setIsOpen(false)} aria-label="ปิด popup">
                ×
              </button>
            </div>

            <form className="metric-modal-form" action={updateServerMetricAction} onSubmit={() => setIsOpen(false)}>
              <input type="hidden" name="metricId" value={metric.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="field-wide">
                {categoryLabel}
                <select name="serverAssetId" defaultValue={metric.serverAssetId} required>
                  {serverOptions.map((server) => (
                    <option key={server.id} value={server.id}>{server.name}</option>
                  ))}
                </select>
              </label>
              <label>
                วันที่วัด
                <input name="measuredAt" type="datetime-local" defaultValue={metric.measuredAt} required />
              </label>
              <label>
                CPU %
                <input name="cpuPercent" type="number" min="0" max="100" step="0.01" defaultValue={metric.cpuPercent} required />
              </label>
              <label>
                RAM ใช้ (GB)
                <input name="ramUsedGb" type="number" min="0" step="0.01" defaultValue={metric.ramUsedGb} required />
              </label>
              <label>
                Disk ใช้ (GB)
                <input name="diskUsedGb" type="number" min="0" step="0.01" defaultValue={metric.diskUsedGb} required />
              </label>
              <label className="field-wide">
                รายละเอียด
                <input name="note" defaultValue={metric.note} placeholder="รายละเอียดเพิ่มเติม" />
              </label>

              <div className="metric-modal-footer">
                <button className="button secondary" type="button" onClick={() => setIsOpen(false)}>ยกเลิก</button>
                <button className="button" type="submit">บันทึกการแก้ไข</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
