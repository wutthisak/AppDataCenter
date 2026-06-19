"use client";

import { useMemo, useState } from "react";
import type { AssetStatusCode } from "@prisma/client";
import { bulkUpsertStatusAction } from "@/app/actions";
import { statusLabels } from "@/lib/constants";

type DailyAsset = {
  id: string;
  displayOrder: number;
  name: string;
  active: boolean;
};

type StatusByAsset = {
  assetId: string;
  statuses: Partial<Record<number, AssetStatusCode>>;
};

export function DailyCategoryStatusForm({
  reportId,
  categoryCode,
  returnTo,
  maxDay,
  assets,
  options,
  statusByAsset
}: {
  reportId: string;
  categoryCode: string;
  returnTo: string;
  maxDay: number;
  assets: DailyAsset[];
  options: AssetStatusCode[];
  statusByAsset: StatusByAsset[];
}) {
  const activeAssetIds = useMemo(() => assets.filter((asset) => asset.active).map((asset) => asset.id), [assets]);
  const statusMap = useMemo(() => new Map(statusByAsset.map((item) => [item.assetId, item.statuses])), [statusByAsset]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>(activeAssetIds);
  const allActiveSelected = activeAssetIds.length > 0 && activeAssetIds.every((id) => selectedIds.includes(id));

  function toggleAll() {
    setSelectedIds(allActiveSelected ? [] : activeAssetIds);
  }

  function toggleAsset(assetId: string) {
    setSelectedIds((current) => current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]);
  }

  return (
    <section className="card checklist-status-card">
      <div className="section-heading checklist-heading">
        <div>
          <h2>บันทึกสถานะแบบ Checklist</h2>
          <p className="muted">เลือกวันที่ เลือกรายการในตาราง แล้วบันทึกสถานะเดียวกันพร้อมกัน</p>
        </div>
      </div>

      <form className="checklist-status-form" action={bulkUpsertStatusAction}>
        <input type="hidden" name="reportId" value={reportId} />
        <input type="hidden" name="categoryCode" value={categoryCode} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="checklist-toolbar">
          <label>
            วันที่
            <select name="day" value={selectedDay} onChange={(event) => setSelectedDay(Number(event.target.value))}>
              {Array.from({ length: maxDay }, (_, index) => (
                <option key={index + 1} value={index + 1}>{index + 1}</option>
              ))}
            </select>
          </label>
          <label>
            สถานะ
            <select name="statusCode" defaultValue="N">
              {options.map((code) => (
                <option key={code} value={code}>{code} = {statusLabels[code]}</option>
              ))}
            </select>
          </label>
          <button className="button secondary" type="button" onClick={toggleAll}>
            {allActiveSelected ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
          </button>
          <button className="button" type="submit" disabled={selectedIds.length === 0}>บันทึกสถานะ</button>
          <span className="muted">เลือกแล้ว {selectedIds.length} รายการ</span>
        </div>

        <div className="table-wrap">
          <table className="checklist-table">
            <thead>
              <tr>
                <th className="checklist-select-col">เลือก</th>
                <th className="checklist-no-col">ลำดับ</th>
                <th>รายการ</th>
                <th className="checklist-status-col">สถานะปัจจุบัน</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const currentStatus = statusMap.get(asset.id)?.[selectedDay];
                return (
                  <tr className={asset.active ? "" : "is-inactive"} key={asset.id}>
                    <td className="checklist-select-col">
                      <input
                        type="checkbox"
                        name="assetIds"
                        value={asset.id}
                        checked={selectedIds.includes(asset.id)}
                        disabled={!asset.active}
                        onChange={() => toggleAsset(asset.id)}
                      />
                    </td>
                    <td className="checklist-no-col">{asset.displayOrder}</td>
                    <td className="checklist-name-cell">{asset.name}</td>
                    <td className="checklist-status-col">
                      {currentStatus ? `${currentStatus} - ${statusLabels[currentStatus]}` : "ยังไม่บันทึก"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </form>
    </section>
  );
}
