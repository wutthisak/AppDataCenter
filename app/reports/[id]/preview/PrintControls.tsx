"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import type { AssetCategoryCode } from "@prisma/client";

export function PrintControls({ reportId, categoryCode, returnTo }: { reportId: string; categoryCode?: AssetCategoryCode | null; returnTo?: string | null }) {
  const editHref = returnTo ?? `/reports/${reportId}${categoryCode ? `?category=${categoryCode}` : ""}`;

  return (
    <div className="preview-actions no-print">
      <Link className="button secondary back-button" href={editHref}>
        <ArrowLeft size={16} />
        กลับไปแก้ไข
      </Link>
      <button className="button print-button" type="button" onClick={() => window.print()}>
        <Printer size={16} />
        พิมพ์ / บันทึก PDF
      </button>
    </div>
  );
}
