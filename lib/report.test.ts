import { describe, expect, it } from "vitest";
import { daysInThaiMonth } from "@/lib/date";
import { diskUsagePercent, validateDay, validateStatusCode } from "@/lib/report";

describe("monthly report validation", () => {
  it("limits days to the real month length", () => {
    expect(daysInThaiMonth(2, 2567)).toBe(29);
    expect(validateDay(2, 2567, 29)).toBe(true);
    expect(validateDay(2, 2567, 30)).toBe(false);
  });

  it("allows all operation status codes for server-like categories", () => {
    expect(validateStatusCode("SERVER", "N")).toBe(true);
    expect(validateStatusCode("SERVER", "R")).toBe(true);
  });

  it("allows only success/fail codes for backup", () => {
    expect(validateStatusCode("BACKUP", "N")).toBe(true);
    expect(validateStatusCode("BACKUP", "F")).toBe(true);
    expect(validateStatusCode("BACKUP", "R")).toBe(false);
  });

  it("calculates disk usage trend values", () => {
    expect(diskUsagePercent(75, 100)).toBe(75);
    expect(diskUsagePercent(1, 3)).toBe(33.3);
  });
});
