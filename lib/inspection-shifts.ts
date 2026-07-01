export const inspectionShiftOrder = ["OFFICE_HOURS", "MORNING_SHIFT", "AFTERNOON_SHIFT", "NIGHT_SHIFT"] as const;

export type InspectionShiftKey = (typeof inspectionShiftOrder)[number];

export const inspectionShiftLabels: Record<InspectionShiftKey, string> = {
  OFFICE_HOURS: "ในเวลาราชการ",
  MORNING_SHIFT: "เวรเช้า",
  AFTERNOON_SHIFT: "เวรบ่าย",
  NIGHT_SHIFT: "เวรดึก"
};

export const inspectionShiftFullLabels: Record<InspectionShiftKey, string> = {
  OFFICE_HOURS: "08:00 น. - 16.00 น. ในเวลาราชการ",
  MORNING_SHIFT: "08:00 น. - 16.00 น. เวรเช้า",
  AFTERNOON_SHIFT: "16.00 น. - 24.00 น. เวรบ่าย",
  NIGHT_SHIFT: "24.00 น. - 08.00 น. เวรดึก"
};

export const inspectionShiftColors: Record<InspectionShiftKey, string> = {
  OFFICE_HOURS: "#2563eb",
  MORNING_SHIFT: "#14b8a6",
  AFTERNOON_SHIFT: "#f97316",
  NIGHT_SHIFT: "#8b5cf6"
};

export const inspectionTimeSlotOrder = [
  "SLOT_0800_0900",
  "SLOT_0900_1000",
  "SLOT_1100_1200",
  "SLOT_1300_1400",
  "SLOT_1400_1500",
  "SLOT_1500_1600",
  "SLOT_1600_1700",
  "SLOT_1700_1800",
  "SLOT_1800_1900",
  "SLOT_1900_2000",
  "SLOT_2000_2100",
  "SLOT_2100_2200",
  "SLOT_2200_2300",
  "SLOT_2300_2400",
  "SLOT_0000_0100",
  "SLOT_0100_0200",
  "SLOT_0200_0300",
  "SLOT_0300_0400",
  "SLOT_0400_0500",
  "SLOT_0500_0600",
  "SLOT_0600_0700",
  "SLOT_0700_0800"
] as const;

export type InspectionTimeSlotKey = typeof inspectionTimeSlotOrder[number];

export const inspectionTimeSlotLabels: Record<InspectionTimeSlotKey, string> = {
  SLOT_0800_0900: "08:00 - 09:00",
  SLOT_0900_1000: "09:00 - 10:00",
  SLOT_1100_1200: "11:00 - 12:00",
  SLOT_1300_1400: "13:00 - 14:00",
  SLOT_1400_1500: "14:00 - 15:00",
  SLOT_1500_1600: "15:00 - 16:00",
  SLOT_1600_1700: "16:00 - 17:00",
  SLOT_1700_1800: "17:00 - 18:00",
  SLOT_1800_1900: "18:00 - 19:00",
  SLOT_1900_2000: "19:00 - 20:00",
  SLOT_2000_2100: "20:00 - 21:00",
  SLOT_2100_2200: "21:00 - 22:00",
  SLOT_2200_2300: "22:00 - 23:00",
  SLOT_2300_2400: "23:00 - 24:00",
  SLOT_0000_0100: "00:00 - 01:00",
  SLOT_0100_0200: "01:00 - 02:00",
  SLOT_0200_0300: "02:00 - 03:00",
  SLOT_0300_0400: "03:00 - 04:00",
  SLOT_0400_0500: "04:00 - 05:00",
  SLOT_0500_0600: "05:00 - 06:00",
  SLOT_0600_0700: "06:00 - 07:00",
  SLOT_0700_0800: "07:00 - 08:00"
};

export const shiftDefaultSlots: Record<InspectionShiftKey, InspectionTimeSlotKey[]> = {
  OFFICE_HOURS:    ["SLOT_0800_0900", "SLOT_0900_1000", "SLOT_1100_1200", "SLOT_1300_1400", "SLOT_1400_1500", "SLOT_1500_1600"],
  MORNING_SHIFT:   ["SLOT_0800_0900", "SLOT_0900_1000", "SLOT_1100_1200", "SLOT_1300_1400", "SLOT_1400_1500", "SLOT_1500_1600"],
  AFTERNOON_SHIFT: ["SLOT_1600_1700", "SLOT_1700_1800", "SLOT_1800_1900", "SLOT_1900_2000", "SLOT_2000_2100", "SLOT_2100_2200", "SLOT_2200_2300", "SLOT_2300_2400"],
  NIGHT_SHIFT:     ["SLOT_0000_0100", "SLOT_0100_0200", "SLOT_0200_0300", "SLOT_0300_0400", "SLOT_0400_0500", "SLOT_0500_0600", "SLOT_0600_0700", "SLOT_0700_0800"]
};

export type WorkloadShiftKey = "MORNING" | "AFTERNOON" | "NIGHT";

export function isInspectionTimeSlotKey(value: unknown): value is InspectionTimeSlotKey {
  return typeof value === "string" && (inspectionTimeSlotOrder as readonly string[]).includes(value);
}

export function getShiftForTimeSlot(value: unknown): InspectionShiftKey {
  if (!isInspectionTimeSlotKey(value)) return "OFFICE_HOURS";
  if (shiftDefaultSlots.AFTERNOON_SHIFT.includes(value)) return "AFTERNOON_SHIFT";
  if (shiftDefaultSlots.NIGHT_SHIFT.includes(value)) return "NIGHT_SHIFT";
  return "OFFICE_HOURS";
}

export function getWorkloadShiftForHour(hour: number): WorkloadShiftKey {
  if (hour >= 16 && hour < 24) return "AFTERNOON";
  if (hour >= 8 && hour < 16) return "MORNING";
  return "NIGHT";
}

export function getWorkloadShiftForDateTime(value: Date | string | null | undefined): WorkloadShiftKey | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return getWorkloadShiftForHour(date.getHours());
}

export function getWorkloadShiftForTimeSlot(value: unknown): WorkloadShiftKey {
  const shift = getShiftForTimeSlot(value);
  if (shift === "AFTERNOON_SHIFT") return "AFTERNOON";
  if (shift === "NIGHT_SHIFT") return "NIGHT";
  return "MORNING";
}

export function getCurrentInspectionTimeSlot(now = new Date()): InspectionTimeSlotKey {
  const hour = now.getHours();
  if (hour === 0) return "SLOT_0000_0100";
  if (hour === 1) return "SLOT_0100_0200";
  if (hour === 2) return "SLOT_0200_0300";
  if (hour === 3) return "SLOT_0300_0400";
  if (hour === 4) return "SLOT_0400_0500";
  if (hour === 5) return "SLOT_0500_0600";
  if (hour === 6) return "SLOT_0600_0700";
  if (hour === 7) return "SLOT_0700_0800";
  if (hour === 8) return "SLOT_0800_0900";
  if (hour === 9 || hour === 10) return "SLOT_0900_1000";
  if (hour === 11 || hour === 12) return "SLOT_1100_1200";
  if (hour === 13) return "SLOT_1300_1400";
  if (hour === 14) return "SLOT_1400_1500";
  if (hour === 15) return "SLOT_1500_1600";
  if (hour === 16) return "SLOT_1600_1700";
  if (hour === 17) return "SLOT_1700_1800";
  if (hour === 18) return "SLOT_1800_1900";
  if (hour === 19) return "SLOT_1900_2000";
  if (hour === 20) return "SLOT_2000_2100";
  if (hour === 21) return "SLOT_2100_2200";
  if (hour === 22) return "SLOT_2200_2300";
  return "SLOT_2300_2400";
}

export function getDefaultInspectionSelection(preferredSlot?: unknown) {
  const timeSlot = isInspectionTimeSlotKey(preferredSlot) ? preferredSlot : getCurrentInspectionTimeSlot();
  return {
    timeSlot,
    shift: getShiftForTimeSlot(timeSlot)
  };
}
