"use client";

import type { AssetCategoryCode, AssetStatusCode } from "@prisma/client";
import { bulkUpsertStatusAction } from "@/app/actions";

export function BulkDayStatusForm({
  reportId,
  categoryCode,
  day,
  timeSlot,
  inspectionShift,
  durationMinutes,
  inspectedAt,
  options,
  returnTo
}: {
  reportId: string;
  categoryCode: AssetCategoryCode;
  day: number;
  timeSlot?: string;
  inspectionShift?: string;
  durationMinutes?: number;
  inspectedAt?: string;
  options: AssetStatusCode[];
  returnTo: string;
}) {
  return (
    <form action={bulkUpsertStatusAction}>
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="categoryCode" value={categoryCode} />
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="applyAllActive" value="true" />
      {timeSlot ? <input type="hidden" name="timeSlots" value={timeSlot} /> : null}
      {inspectionShift ? <input type="hidden" name="inspectionShift" value={inspectionShift} /> : null}
      {durationMinutes ? <input type="hidden" name="durationMinutes" value={durationMinutes} /> : null}
      {inspectedAt ? <input type="hidden" name="inspectedAt" value={inspectedAt} /> : null}
      <select
        className="status-select bulk-day-select"
        name="statusCode"
        defaultValue=""
        onChange={(event) => {
          const select = event.currentTarget;
          const status = select.value;
          if (!status) return;
          if (window.confirm(`ยืนยันบันทึกสถานะ ${status} ให้รายการทั้งหมดของวันที่ ${day}?`)) {
            select.form?.requestSubmit();
          } else {
            select.value = "";
          }
        }}
      >
        <option value="">-</option>
        {options.map((status) => (
          <option key={status} value={status}>{status}</option>
        ))}
      </select>
    </form>
  );
}
