import type { AssetCategoryCode, AssetStatusCode } from "@prisma/client";
import { allowedStatusCodes } from "@/lib/constants";
import { daysInThaiMonth } from "@/lib/date";

export function validateDay(month: number, buddhistYear: number, day: number) {
  const maxDay = daysInThaiMonth(month, buddhistYear);
  return Number.isInteger(day) && day >= 1 && day <= maxDay;
}

export function validateStatusCode(category: AssetCategoryCode, status: string): status is AssetStatusCode {
  return allowedStatusCodes(category).includes(status as AssetStatusCode);
}

export function diskUsagePercent(usedGb: number, totalGb: number) {
  if (totalGb <= 0) return 0;
  return Math.round((usedGb / totalGb) * 1000) / 10;
}
