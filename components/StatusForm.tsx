"use client";

import { useEffect, useState } from "react";
import type { AssetStatusCode } from "@prisma/client";
import { upsertStatusAction } from "@/app/actions";

export function StatusForm({
  reportId,
  assetId,
  day,
  timeSlot,
  value,
  options,
  returnTo
}: {
  reportId: string;
  assetId: string;
  day: number;
  timeSlot?: string;
  value?: AssetStatusCode;
  options: AssetStatusCode[];
  returnTo?: string;
}) {
  const [selectedStatus, setSelectedStatus] = useState<AssetStatusCode | "">(value ?? "");

  useEffect(() => {
    setSelectedStatus(value ?? "");
  }, [value]);

  return (
    <form action={upsertStatusAction}>
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="day" value={day} />
      {timeSlot ? <input type="hidden" name="timeSlot" value={timeSlot} /> : null}
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <select
        className="status-select"
        name="statusCode"
        value={selectedStatus}
        onChange={(event) => {
          const newVal = event.target.value as AssetStatusCode | "";
          const form = event.currentTarget.form;
          if (!newVal) {
            setSelectedStatus("");
            return;
          }
          if (window.confirm(`ยืนยันบันทึกสถานะ "${newVal}" ?`)) {
            setSelectedStatus(newVal);
            form?.requestSubmit();
          } else {
            event.target.value = selectedStatus;
          }
        }}
      >
        <option value="">-</option>
        {options.map((code) => (
          <option key={code} value={code}>{code}</option>
        ))}
      </select>
    </form>
  );
}
