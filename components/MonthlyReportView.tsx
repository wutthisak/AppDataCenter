"use client";

import { useMemo, useState } from "react";
import type { AssetCategoryCode, AssetStatusCode } from "@prisma/client";
import { StatusForm } from "./StatusForm";
import { BulkDayStatusForm } from "./BulkDayStatusForm";

const STATUS_COLORS: Record<string, string> = {
  N: "#16a34a",
  H: "#f59e0b",
  F: "#dc2626",
  D: "#6b7280",
  C: "#0ea5e9",
  R: "#8b5cf6",
};

export type MonthlyEntryInfo = {
  statusCode: AssetStatusCode;
  recordedById?: string | null;
  updatedById?: string | null;
  recordedBy?: { displayName: string } | null;
  updatedBy?: { displayName: string } | null;
  updatedAt?: Date | string;
  createdAt?: Date | string;
};

function RecordedCell({ entry }: { entry: MonthlyEntryInfo }) {
  const color = STATUS_COLORS[entry.statusCode] ?? "#374151";
  const recorder = entry.updatedBy?.displayName ?? entry.recordedBy?.displayName ?? "—";
  const dateStr = entry.updatedAt
    ? new Date(entry.updatedAt).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <span
      title={`ผู้บันทึก: ${recorder}\nเวลา: ${dateStr}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontWeight: 700,
        fontSize: "0.8rem",
        color,
        cursor: "default",
      }}
    >
      {entry.statusCode}
    </span>
  );
}

export function MonthlyReportView({
  reportId,
  categoryCode,
  assets,
  visibleDays,
  entryMap,
  options,
  returnTo,
  editable,
  userId,
  userRole,
}: {
  reportId: string;
  categoryCode: AssetCategoryCode;
  assets: { id: string; displayOrder: number; name: string; active: boolean }[];
  visibleDays: number[];
  entryMap: Map<string, MonthlyEntryInfo>;
  options: AssetStatusCode[];
  returnTo: string;
  editable: boolean;
  userId?: string;
  userRole?: string;
}) {
  const [showOnlyUnrecorded, setShowOnlyUnrecorded] = useState(false);

  const filteredAssets = useMemo(() => {
    if (!showOnlyUnrecorded) return assets;
    return assets.filter((asset) => {
      return visibleDays.some((day) => !entryMap.has(`${asset.id}:${day}`));
    });
  }, [assets, entryMap, visibleDays, showOnlyUnrecorded]);

  const canEditEntry = (entry: MonthlyEntryInfo | undefined) => {
    if (!editable) return false;
    if (!entry) return true;
    if (userRole === "ADMIN") return true;
    return entry.recordedById === userId || entry.updatedById === userId;
  };

  return (
    <div>
      {/* Filter */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", padding: "0.5rem 0", marginBottom: "0.5rem" }}>
        {editable && (
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: "#475569", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showOnlyUnrecorded}
              onChange={(e) => setShowOnlyUnrecorded(e.target.checked)}
              style={{ accentColor: "#3b82f6" }}
            />
            แสดงเฉพาะรายการที่ยังไม่บันทึก
          </label>
        )}
      </div>

      <div className="table-wrap" style={{ maxHeight: "70vh", overflow: "auto" }}>
        <table className="daily-table compact-daily-table">
          <thead className="sticky-thead">
            <tr>
              <th className="asset-name">รายการ</th>
              {visibleDays.map((day) => (
                <th key={day}>{day}</th>
              ))}
            </tr>
            {editable && (
              <tr className="bulk-day-row">
                <th className="asset-name" style={{ fontSize: "0.75rem", color: "#174bd1", background: "#eaf2ff" }}>
                  บันทึกทั้งแถว
                </th>
                {visibleDays.map((day) => (
                  <th key={day} style={{ background: "#eaf2ff" }}>
                    <BulkDayStatusForm
                      reportId={reportId}
                      categoryCode={categoryCode}
                      day={day}
                      options={options}
                      returnTo={returnTo}
                    />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {filteredAssets.map((asset) => (
              <tr key={asset.id}>
                <td className="asset-name">
                  {asset.displayOrder}. {asset.name}
                </td>
                {visibleDays.map((day) => {
                  const entry = entryMap.get(`${asset.id}:${day}`);
                  const canEdit = canEditEntry(entry);
                  return (
                    <td key={day}>
                      {entry && !canEdit ? (
                        <RecordedCell entry={entry} />
                      ) : editable && asset.active ? (
                        entry ? (
                          <StatusForm
                            reportId={reportId}
                            assetId={asset.id}
                            day={day}
                            value={entry.statusCode}
                            options={options}
                            returnTo={returnTo}
                          />
                        ) : (
                          <StatusForm
                            reportId={reportId}
                            assetId={asset.id}
                            day={day}
                            value={undefined}
                            options={options}
                            returnTo={returnTo}
                          />
                        )
                      ) : entry ? (
                        <RecordedCell entry={entry} />
                      ) : (
                        <span style={{ color: "#d1d5db" }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
