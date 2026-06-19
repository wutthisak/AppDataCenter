export const thaiMonths = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม"
];

export function currentBuddhistYear() {
  return new Date().getFullYear() + 543;
}

export function daysInThaiMonth(month: number, buddhistYear: number) {
  return new Date(buddhistYear - 543, month, 0).getDate();
}

export function thaiMonthLabel(month: number, buddhistYear: number) {
  return `${thaiMonths[month - 1]} ${buddhistYear}`;
}

export function fiscalYearFromDate(date: Date) {
  const buddhistYear = date.getFullYear() + 543;
  return date.getMonth() + 1 >= 10 ? buddhistYear + 1 : buddhistYear;
}
