import type { Asset, AssetCategoryCode, Prisma } from "@prisma/client";

export const assetCategoryRoutes: Partial<Record<string, AssetCategoryCode>> = {
  vm: "VM",
  host: "SERVER",
  network: "NETWORK",
  storage: "STORAGE",
  backup: "BACKUP"
};

export const assetCategorySlugs: Record<AssetCategoryCode, string> = {
  VM: "vm",
  SERVER: "host",
  NETWORK: "network",
  STORAGE: "storage",
  BACKUP: "backup"
};

const GENERATED_BACKUP_JOB_ASSET_PREFIXES = ["BACKUP_JOB:", "BACKUP_JOB_ITEM:"] as const;

export function isGeneratedBackupJobAssetCode(code: string | null | undefined) {
  return GENERATED_BACKUP_JOB_ASSET_PREFIXES.some((prefix) => code?.startsWith(prefix));
}

export function generatedBackupJobAssetExclusion(categoryCode: AssetCategoryCode): Prisma.AssetWhereInput {
  return categoryCode === "BACKUP"
    ? {
        OR: [
          { code: null },
          {
            NOT: GENERATED_BACKUP_JOB_ASSET_PREFIXES.map((prefix) => ({
              code: { startsWith: prefix },
            })),
          },
        ],
      }
    : {};
}

export type AssetField = {
  name: keyof Pick<Asset, "cpu" | "ram" | "disk" | "assetNumber" | "deviceType" | "model" | "brand" | "ipAddress" | "location" | "ownershipType" | "building" | "floor" | "installedAt" | "databaseType" | "databaseServer" | "os">;
  label: string;
  placeholder: string;
  required?: boolean;
  type?: "text" | "date" | "number" | "select";
  source?: "databaseType" | "os" | "networkBrand" | "deviceType" | "storageDeviceType" | "building" | "dataCenter" | "ownershipType";
  options?: string[];
  unitOptions?: { value: string; label: string }[];
};

const thaiShortMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

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
    },
    {
      name: "location",
      label: "Data Center",
      placeholder: "เลือก Data Center",
      type: "select",
      source: "dataCenter"
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
    {
      name: "location",
      label: "Data Center",
      placeholder: "เลือก Data Center",
      type: "select",
      source: "dataCenter"
    },
    {
      name: "ownershipType",
      label: "ประเภททรัพย์สิน",
      placeholder: "เลือกประเภททรัพย์สิน",
      type: "select",
      source: "ownershipType"
    },
    { name: "assetNumber", label: "เลขครุภัณฑ์", placeholder: "เลขครุภัณฑ์", required: true },
    { name: "installedAt", label: "วันที่ติดตั้ง", placeholder: "วันที่ติดตั้ง", required: true, type: "date" }
  ],
  NETWORK: [
    { name: "deviceType", label: "ประเภทอุปกรณ์", placeholder: "เลือกประเภทอุปกรณ์", required: true, type: "select", source: "deviceType" },
    { name: "ownershipType", label: "ประเภททรัพย์สิน", placeholder: "เลือกประเภททรัพย์สิน", type: "select", source: "ownershipType" },
    { name: "model", label: "รุ่น", placeholder: "รุ่น", required: true },
    { name: "ipAddress", label: "IP", placeholder: "เช่น 192.168.1.1", required: true },
    { name: "brand", label: "ยี่ห้อ", placeholder: "เลือกยี่ห้อ", required: true, type: "select", source: "networkBrand" },
    { name: "location", label: "สถานที่", placeholder: "สถานที่", required: true },
    { name: "floor", label: "ชั้น", placeholder: "ชั้น", required: true },
    { name: "building", label: "อาคาร", placeholder: "เลือกอาคาร", required: true, type: "select", source: "building" },
    { name: "installedAt", label: "วันที่ติดตั้ง", placeholder: "วันที่ติดตั้ง", required: true, type: "date" }
  ],
  STORAGE: [
    { name: "deviceType", label: "ประเภทอุปกรณ์", placeholder: "เลือกประเภทอุปกรณ์", type: "select", source: "storageDeviceType" },
    { name: "ownershipType", label: "ประเภททรัพย์สิน", placeholder: "เลือกประเภททรัพย์สิน", type: "select", source: "ownershipType" },
    { name: "brand", label: "ยี่ห้อ", placeholder: "ยี่ห้อ" },
    { name: "model", label: "รุ่น", placeholder: "รุ่น" },
    { name: "ipAddress", label: "IP", placeholder: "เช่น 192.168.1.10" },
    { name: "location", label: "Data Center", placeholder: "เลือก Data Center", type: "select", source: "dataCenter" },
    {
      name: "disk",
      label: "ความจุ",
      placeholder: "เช่น 100",
      type: "number",
      unitOptions: [
        { value: "GB", label: "GB" },
        { value: "TB", label: "TB" }
      ]
    },
    { name: "assetNumber", label: "เลขครุภัณฑ์", placeholder: "เลขครุภัณฑ์" },
    { name: "installedAt", label: "วันที่ติดตั้ง", placeholder: "วันที่ติดตั้ง", type: "date" }
  ],
  BACKUP: [
    {
      name: "databaseType",
      label: "Type Database",
      placeholder: "เลือกประเภท Database",
      type: "select",
      source: "databaseType",
      options: ["MySQL", "MariaDB", "PostgreSQL", "Oracle", "SQL Server", "MongoDB", "Redis"]
    }
  ]
};

export function fieldValue(asset: Asset, field: AssetField) {
  const value = asset[field.name];
  if (field.type === "date") {
    return value instanceof Date ? formatBuddhistInputDate(value) : "";
  }
  return typeof value === "string" ? value : "";
}

export function displayValue(asset: Asset, field: AssetField) {
  const value = asset[field.name];
  if (field.type === "date") {
    return value instanceof Date ? formatBuddhistDate(value) : "-";
  }
  return typeof value === "string" && value ? value : "-";
}

export function formatBuddhistInputDate(value: Date | null | undefined) {
  if (!value) return "";
  return `${pad2(value.getUTCDate())}/${pad2(value.getUTCMonth() + 1)}/${value.getUTCFullYear() + 543}`;
}

export function formatBuddhistDate(value: Date | null | undefined) {
  if (!value) return "-";
  return `${pad2(value.getUTCDate())} ${thaiShortMonths[value.getUTCMonth()]} ${value.getUTCFullYear() + 543}`;
}

export function formatBuddhistLocalDate(value: Date | null | undefined) {
  if (!value) return "-";
  return `${pad2(value.getDate())} ${thaiShortMonths[value.getMonth()]} ${value.getFullYear() + 543}`;
}

export function parseBuddhistDateInput(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const day = slashMatch ? Number(slashMatch[1]) : isoMatch ? Number(isoMatch[3]) : NaN;
  const month = slashMatch ? Number(slashMatch[2]) : isoMatch ? Number(isoMatch[2]) : NaN;
  const rawYear = slashMatch ? Number(slashMatch[3]) : isoMatch ? Number(isoMatch[1]) : NaN;
  const year = rawYear >= 2400 ? rawYear - 543 : rawYear;

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
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

  let months = (now.getUTCFullYear() - installedAt.getUTCFullYear()) * 12 + now.getUTCMonth() - installedAt.getUTCMonth();
  if (now.getUTCDate() < installedAt.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function equipmentAgeRisk(installedAt: Date | null, now = new Date()): EquipmentAgeRisk {
  const months = equipmentAgeMonths(installedAt, now);
  if (months === null) return "unknown";

  const years = months / 12;
  if (years >= 11) return "high";
  if (years >= 6) return "medium";
  return "low";
}
