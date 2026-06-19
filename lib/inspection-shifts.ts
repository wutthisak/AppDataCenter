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
