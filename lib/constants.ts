import type { AssetCategoryCode, AssetStatusCode, Role } from "@prisma/client";

export const appName = "Data Center Operations";

export const categoryLabels: Record<AssetCategoryCode, string> = {
  VM: "ตรวจสอบ VM Host",
  SERVER: "ตรวจสอบ Host Server",
  NETWORK: "ตรวจสอบ Network Device",
  BACKUP: "ตรวจสอบ Database"
};

export const assetAccountLabels: Record<AssetCategoryCode, string> = {
  VM: "บัญชีทรัพย์สิน VM Host",
  SERVER: "บัญชีทรัพย์สิน Host Server",
  NETWORK: "บัญชีทรัพย์สิน Network Device",
  BACKUP: "บัญชีทรัพย์สิน Database"
};

export const categoryDescriptions: Record<AssetCategoryCode, string> = {
  VM: "ตรวจสอบ VM Host พร้อม CPU, RAM และ DISK",
  SERVER: "ตรวจสอบ Host Server พร้อม CPU, RAM, DISK และเลขครุภัณฑ์",
  NETWORK: "ตรวจสอบ Network Device พร้อมรุ่น ยี่ห้อ IP สถานที่ อาคาร และชั้น",
  BACKUP: "ตรวจสอบสถานะ Database"
};

export const statusLabels: Record<AssetStatusCode, string> = {
  N: "ปกติ / สำเร็จ",
  H: "หยุดระบบชั่วคราว",
  F: "ผิดปกติ / ไม่สำเร็จ",
  D: "ระบบล่ม",
  C: "ปิดระบบ",
  R: "รีสตาร์ทระบบใหม่"
};

export const normalStatusCodes: AssetStatusCode[] = ["N", "H", "F", "D", "C", "R"];
export const backupStatusCodes: AssetStatusCode[] = ["N", "F"];

export const roleLabels: Record<Role, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  OPERATOR: "ผู้ปฏิบัติงาน"
};

export function allowedStatusCodes(category: AssetCategoryCode): AssetStatusCode[] {
  return category === "BACKUP" ? backupStatusCodes : normalStatusCodes;
}
