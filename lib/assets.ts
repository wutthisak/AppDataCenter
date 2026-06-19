import type { Asset, AssetCategoryCode } from "@prisma/client";

export const assetCategoryRoutes: Partial<Record<string, AssetCategoryCode>> = {
  vm: "VM",
  host: "SERVER",
  network: "NETWORK",
  backup: "BACKUP"
};

export const assetCategorySlugs: Record<AssetCategoryCode, string> = {
  VM: "vm",
  SERVER: "host",
  NETWORK: "network",
  BACKUP: "backup"
};

export type AssetField = {
  name: keyof Pick<Asset, "cpu" | "ram" | "disk" | "assetNumber" | "model" | "brand" | "ipAddress" | "location" | "building" | "floor" | "installedAt" | "databaseType" | "databaseServer" | "os">;
  label: string;
  placeholder: string;
  required?: boolean;
  type?: "text" | "date" | "number" | "select";
  source?: "databaseType" | "os" | "networkBrand" | "building";
  options?: string[];
  unitOptions?: { value: string; label: string }[];
};

export const fieldsByCategory: Record<AssetCategoryCode, AssetField[]> = {
  VM: [
    {
      name: "cpu",
      label: "CPU",
      placeholder: "เช่น 4",
      required: true,
      type: "number",
      unitOptions: [
        { value: "Core", label: "Core" }
      ]
    },
    {
      name: "ram",
      label: "RAM",
      placeholder: "เช่น 16",
      required: true,
      type: "number",
      unitOptions: [
        { value: "GB", label: "GB" },
        { value: "TB", label: "TB" }
      ]
    },
    {
      name: "disk",
      label: "DISK",
      placeholder: "เช่น 500",
      required: true,
      type: "number",
      unitOptions: [
        { value: "GB", label: "GB" },
        { value: "TB", label: "TB" }
      ]
    },
    {
      name: "os",
      label: "Type OS",
      placeholder: "เลือกระบบปฏิบัติการ",
      type: "select",
      source: "os"
    }
  ],
  SERVER: [
    {
      name: "cpu",
      label: "CPU",
      placeholder: "เช่น 16",
      required: true,
      type: "number",
      unitOptions: [
        { value: "Core", label: "Core" }
      ]
    },
    {
      name: "ram",
      label: "RAM",
      placeholder: "เช่น 128",
      required: true,
      type: "number",
      unitOptions: [
        { value: "GB", label: "GB" },
        { value: "TB", label: "TB" }
      ]
    },
    {
      name: "disk",
      label: "DISK",
      placeholder: "เช่น 2",
      required: true,
      type: "number",
      unitOptions: [
        { value: "GB", label: "GB" },
        { value: "TB", label: "TB" }
      ]
    },
    {
      name: "os",
      label: "Type OS",
      placeholder: "เลือกระบบปฏิบัติการ",
      type: "select",
      source: "os"
    },
    { name: "assetNumber", label: "เลขครุภัณฑ์", placeholder: "เลขครุภัณฑ์", required: true },
    { name: "installedAt", label: "วันที่ติดตั้ง", placeholder: "วันที่ติดตั้ง", required: true, type: "date" }
  ],
  NETWORK: [
    { name: "model", label: "รุ่น", placeholder: "รุ่น", required: true },
    { name: "brand", label: "ยี่ห้อ", placeholder: "เลือกยี่ห้อ", required: true, type: "select", source: "networkBrand" },
    { name: "ipAddress", label: "IP", placeholder: "เช่น 192.168.1.1", required: true },
    { name: "location", label: "สถานที่", placeholder: "สถานที่", required: true },
    { name: "building", label: "อาคาร", placeholder: "เลือกอาคาร", required: true, type: "select", source: "building" },
    { name: "floor", label: "ชั้น", placeholder: "ชั้น", required: true },
    { name: "installedAt", label: "วันที่ติดตั้ง", placeholder: "วันที่ติดตั้ง", required: true, type: "date" }
  ],
  BACKUP: [
    {
      name: "databaseType",
      label: "Type Database",
      placeholder: "เลือกประเภท Database",
      type: "select",
      source: "databaseType",
      options: ["MySQL", "MariaDB", "PostgreSQL", "Oracle", "SQL Server", "MongoDB", "Redis"]
    },
    { name: "databaseServer", label: "Server DB", placeholder: "ชื่อเครื่องหรือ IP เช่น db01 / 10.0.0.5" }
  ]
};

export function fieldValue(asset: Asset, field: AssetField) {
  const value = asset[field.name];
  if (field.type === "date") {
    return value instanceof Date ? value.toISOString().slice(0, 10) : "";
  }
  return typeof value === "string" ? value : "";
}

export function displayValue(asset: Asset, field: AssetField) {
  const value = asset[field.name];
  if (field.type === "date") {
    return value instanceof Date ? value.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) : "-";
  }
  return typeof value === "string" && value ? value : "-";
}

export function parseAssetCapacityGb(value: string | null | undefined) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;

  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([a-z]+)?/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = match[2] ?? "gb";
  if (["tb", "t", "tib"].includes(unit)) return amount * 1024;
  if (["gb", "g", "gib"].includes(unit)) return amount;
  if (["mb", "m", "mib"].includes(unit)) return amount / 1024;

  return null;
}

const quantityUnitMap: Record<string, string> = {
  core: "Core",
  ghz: "GHz",
  gb: "GB",
  tb: "TB",
  t: "TB",
  mb: "MB",
  mib: "MB",
  gib: "GB"
};

export function parseAssetQuantity(value: string | null | undefined, defaultUnit = "") {
  const text = String(value ?? "").trim().replace(/,/g, "");
  if (!text) return { amount: "", unit: defaultUnit };

  const match = text.match(/^(\d+(?:\.\d+)?)(?:\s*([a-zA-Z]+))?$/);
  if (!match) return { amount: "", unit: defaultUnit };

  const amount = match[1] ?? "";
  const rawUnit = match[2]?.toLowerCase() ?? "";
  const unit = rawUnit ? quantityUnitMap[rawUnit] ?? rawUnit : defaultUnit;

  return { amount, unit };
}

export function equipmentAge(installedAt: Date | null, now = new Date()) {
  const months = equipmentAgeMonths(installedAt, now);
  if (months === null) return installedAt && installedAt > now ? "ยังไม่ถึงวันติดตั้ง" : "-";
  if (months <= 0) return "น้อยกว่า 1 เดือน";

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years > 0 && remainingMonths > 0) return `${years} ปี ${remainingMonths} เดือน`;
  if (years > 0) return `${years} ปี`;
  return `${remainingMonths} เดือน`;
}

export type EquipmentAgeRisk = "low" | "medium" | "high" | "unknown";

export function equipmentAgeMonths(installedAt: Date | null, now = new Date()) {
  if (!installedAt || installedAt > now) return null;

  let months = (now.getFullYear() - installedAt.getFullYear()) * 12 + now.getMonth() - installedAt.getMonth();
  if (now.getDate() < installedAt.getDate()) months -= 1;
  return Math.max(0, months);
}

export function equipmentAgeRisk(installedAt: Date | null, now = new Date()): EquipmentAgeRisk {
  const months = equipmentAgeMonths(installedAt, now);
  if (months === null) return "unknown";

  const years = months / 12;
  if (years >= 10) return "high";
  if (years >= 6) return "medium";
  return "low";
}
