"use client";

import Link from "next/link";
import type { AssetCategoryCode } from "@prisma/client";

export function PrintControls({ reportId, categoryCode }: { reportId: string; categoryCode?: AssetCategoryCode | null }) {
  const editHref = `/reports/${reportId}${categoryCode ? `?category=${categoryCode}` : ""}`;

  return (
    <div className="preview-actions no-print">
      <Link className="button secondary" href={editHref}>กลับไปแก้ไข</Link>
      <button className="button" type="button" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button>
    </div>
  );
}
