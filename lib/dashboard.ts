import type {
  AssetCategoryCode,
  AssetStatusCode,
  InspectionShift,
  InspectionStatus,
  MetricStatus,
  Prisma
} from "@prisma/client";
import { allowedStatusCodes, categoryLabels, statusLabels } from "@/lib/constants";
import { currentBuddhistYear, daysInThaiMonth, thaiMonthLabel } from "@/lib/date";
import { diskUsagePercent } from "@/lib/report";
import { prisma } from "@/lib/prisma";
import { generatedBackupJobAssetExclusion, isGeneratedBackupJobAssetCode } from "@/lib/assets";
import {
  getShiftForTimeSlot,
  inspectionShiftFullLabels,
  inspectionShiftLabels,
  inspectionShiftOrder,
  inspectionTimeSlotLabels,
  isInspectionTimeSlotKey,
  shiftDefaultSlots,
  type InspectionShiftKey,
  type InspectionTimeSlotKey
} from "@/lib/inspection-shifts";

export type DashboardMode = "daily" | "monthly";

export type DashboardFilters = {
  mode: DashboardMode;
  day: number;
  month: number;
  buddhistYear: number;
  maxDay: number;
  category: AssetCategoryCode | "all";
  status: DashboardStatusFilter;
  shift: InspectionShiftKey | "all";
  dataCenterId: string;
  assetId: string;
};

export type DashboardSearchParams = Record<string, string | string[] | undefined> | URLSearchParams | undefined;

export type DashboardStatusFilter =
  | "all"
  | AssetStatusCode
  | InspectionStatus
  | MetricStatus
  | "ABNORMAL";

export type DashboardRawRow = {
  source: "บันทึกสถานะทรัพย์สิน" | "ค่าทรัพยากรเซิร์ฟเวอร์" | "ตรวจห้อง Data Center";
  date: string;
  category: string;
  item: string;
  status: string;
  note: string;
  operator: string;
  shift: string;
  timeSlot: string;
  dataCenter: string;
  cpu: string;
  ram: string;
  disk: string;
  updatedAt: string;
};

const assetCategoryValues = ["VM", "SERVER", "NETWORK", "STORAGE", "BACKUP"] as const satisfies readonly AssetCategoryCode[];
const assetStatusValues = ["N", "H", "F", "D", "C", "R"] as const satisfies readonly AssetStatusCode[];
const metricStatusValues = ["NORMAL", "WARNING", "CRITICAL"] as const satisfies readonly MetricStatus[];
const inspectionStatusValues = ["NORMAL", "ABNORMAL"] as const satisfies readonly InspectionStatus[];
const warningStatusCodes: AssetStatusCode[] = ["H", "C", "R"];
const criticalStatusCodes: AssetStatusCode[] = ["F", "D"];

const categoryColors: Record<AssetCategoryCode, string> = {
  VM: "#2563eb",
  SERVER: "#7c3aed",
  NETWORK: "#0891b2",
  STORAGE: "#0f766e",
  BACKUP: "#059669"
};

const metricTrendColors = ["#2563eb", "#14b8a6", "#f97316", "#8b5cf6", "#ef4444", "#0f766e", "#64748b", "#ca8a04"];

const metricStatusLabels: Record<MetricStatus, string> = {
  NORMAL: "ปกติ",
  WARNING: "เฝ้าระวัง",
  CRITICAL: "วิกฤต"
};

const inspectionStatusLabels: Record<InspectionStatus, string> = {
  NORMAL: "ปกติ",
  ABNORMAL: "ผิดปกติ"
};

const statusFilterLabels: Record<Exclude<DashboardStatusFilter, "all">, string> = {
  N: "ปกติ / สำเร็จ",
  H: "หยุดระบบชั่วคราว",
  F: "ผิดปกติ / ไม่สำเร็จ",
  D: "ระบบล่ม",
  C: "ปิดระบบ",
  R: "รีสตาร์ทระบบใหม่",
  NORMAL: "ปกติ",
  WARNING: "เฝ้าระวัง",
  CRITICAL: "วิกฤต",
  ABNORMAL: "ผิดปกติ"
};

function firstParam(params: DashboardSearchParams, key: string) {
  if (!params) return undefined;
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseInteger(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

function isAssetCategoryCode(value: string | undefined): value is AssetCategoryCode {
  return assetCategoryValues.includes(value as AssetCategoryCode);
}

function isAssetStatusCode(value: string | undefined): value is AssetStatusCode {
  return assetStatusValues.includes(value as AssetStatusCode);
}

function isMetricStatus(value: string | undefined): value is MetricStatus {
  return metricStatusValues.includes(value as MetricStatus);
}

function isInspectionStatus(value: string | undefined): value is InspectionStatus {
  return inspectionStatusValues.includes(value as InspectionStatus);
}

function isInspectionShift(value: string | undefined): value is InspectionShiftKey {
  return inspectionShiftOrder.includes(value as InspectionShiftKey);
}

function parseStatus(value: string | undefined): DashboardStatusFilter {
  if (isAssetStatusCode(value) || isMetricStatus(value) || isInspectionStatus(value)) return value;
  return "all";
}

function dayDate(gregorianYear: number, month: number, day: number) {
  const date = new Date(gregorianYear, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDate(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDisplayDateTime(date: Date | null | undefined) {
  return date ? date.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
}

function timeSlotLabel(value: unknown) {
  if (!isInspectionTimeSlotKey(value)) return "";
  return inspectionTimeSlotLabels[value];
}

function timeSlotsForShift(shift: InspectionShiftKey | "all") {
  if (shift === "all") return undefined;
  return shiftDefaultSlots[shift] ?? [];
}

function statusFilterMatchesAsset(statusCode: AssetStatusCode, filter: DashboardStatusFilter) {
  if (filter === "all") return true;
  if (isAssetStatusCode(filter)) return statusCode === filter;
  if (filter === "NORMAL") return statusCode === "N";
  if (filter === "WARNING") return warningStatusCodes.includes(statusCode);
  if (filter === "CRITICAL") return criticalStatusCodes.includes(statusCode);
  if (filter === "ABNORMAL") return statusCode !== "N";
  return false;
}

function statusFilterMatchesMetric(status: MetricStatus, filter: DashboardStatusFilter) {
  switch (filter) {
    case "all":
      return true;
    case "NORMAL":
    case "WARNING":
    case "CRITICAL":
      return status === filter;
    case "ABNORMAL":
      return status !== "NORMAL";
    default:
      return false;
  }
}

function statusFilterMatchesInspection(status: InspectionStatus, filter: DashboardStatusFilter) {
  switch (filter) {
    case "all":
      return true;
    case "NORMAL":
    case "ABNORMAL":
      return status === filter;
    case "WARNING":
    case "CRITICAL":
      return status === "ABNORMAL";
    default:
      return false;
  }
}

function rowStatusLabel(value: string) {
  if (isAssetStatusCode(value)) return statusFilterLabels[value];
  if (isMetricStatus(value)) return metricStatusLabels[value];
  if (isInspectionStatus(value)) return inspectionStatusLabels[value];
  return value;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function average(values: number[]) {
  return values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0;
}

function buildStatusOptionsForCategory(
  category: AssetCategoryCode | "all",
  categories: { code: AssetCategoryCode }[]
) {
  const allLabels: Record<string, string> = {
    ...statusLabels,
    NORMAL: "ปกติ",
    WARNING: "เฝ้าระวัง",
    CRITICAL: "วิกฤต",
    ABNORMAL: "ผิดปกติ"
  };
  const order = ["N", "H", "F", "D", "C", "R", "NORMAL", "WARNING", "CRITICAL", "ABNORMAL"];
  const values = category === "all"
    ? Array.from(new Set(categories.flatMap((item) => allowedStatusCodes(item.code))))
    : allowedStatusCodes(category);

  return [
    { value: "all", label: "ทั้งหมด" },
    ...order
      .filter((value) => values.includes(value as AssetStatusCode))
      .map((value) => ({ value, label: allLabels[value] ?? value }))
  ];
}

export function parseDashboardFilters(params: DashboardSearchParams): DashboardFilters {
  const now = new Date();
  const rawMonth = parseInteger(firstParam(params, "month"), now.getMonth() + 1);
  const rawYear = parseInteger(firstParam(params, "buddhistYear"), currentBuddhistYear());
  const month = rawMonth >= 1 && rawMonth <= 12 ? rawMonth : now.getMonth() + 1;
  const buddhistYear = rawYear > 2400 ? rawYear : currentBuddhistYear();
  const maxDay = daysInThaiMonth(month, buddhistYear);
  const defaultDay = now.getFullYear() + 543 === buddhistYear && now.getMonth() + 1 === month ? now.getDate() : 1;
  const rawDay = parseInteger(firstParam(params, "day"), defaultDay);
  const day = rawDay >= 1 && rawDay <= maxDay ? rawDay : Math.min(defaultDay, maxDay);
  const categoryParam = firstParam(params, "category");
  const shiftParam = firstParam(params, "shift");

  return {
    mode: firstParam(params, "mode") === "monthly" ? "monthly" : "daily",
    day,
    month,
    buddhistYear,
    maxDay,
    category: isAssetCategoryCode(categoryParam) ? categoryParam : "all",
    status: parseStatus(firstParam(params, "status")),
    shift: isInspectionShift(shiftParam) ? shiftParam : "all",
    dataCenterId: firstParam(params, "dataCenterId") ?? "all",
    assetId: firstParam(params, "assetId") ?? "all"
  };
}

export function dashboardQueryString(filters: DashboardFilters, overrides: Partial<DashboardFilters> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  params.set("mode", next.mode);
  params.set("day", String(next.day));
  params.set("month", String(next.month));
  params.set("buddhistYear", String(next.buddhistYear));
  if (next.category !== "all") params.set("category", next.category);
  if (next.status !== "all") params.set("status", next.status);
  if (next.shift !== "all") params.set("shift", next.shift);
  if (next.dataCenterId !== "all") params.set("dataCenterId", next.dataCenterId);
  if (next.assetId !== "all") params.set("assetId", next.assetId);
  return params.toString();
}

export function dashboardPeriod(filters: DashboardFilters) {
  const selectedDate = dayDate(filters.buddhistYear - 543, filters.month, filters.day);
  return {
    selectedDate,
    selectedDateEnd: endOfDate(selectedDate),
    monthStart: dayDate(filters.buddhistYear - 543, filters.month, 1),
    monthEnd: endOfDate(dayDate(filters.buddhistYear - 543, filters.month, filters.maxDay)),
    selectedDateLabel: formatDisplayDate(selectedDate),
    monthLabel: thaiMonthLabel(filters.month, filters.buddhistYear)
  };
}

export async function getDashboardData(filters: DashboardFilters) {
  const period = dashboardPeriod(filters);
  const dateFilter = filters.mode === "daily"
    ? { gte: period.selectedDate, lte: period.selectedDateEnd }
    : { gte: period.monthStart, lte: period.monthEnd };
  const report = await prisma.monthlyReport.findUnique({
    where: { month_buddhistYear: { month: filters.month, buddhistYear: filters.buddhistYear } }
  });

  const [rawCategories, dataCenters, rawAssets] = await Promise.all([
    prisma.assetCategory.findMany({
      include: { assets: { where: { active: true }, orderBy: { displayOrder: "asc" } } },
      orderBy: { displayOrder: "asc" }
    }),
    prisma.dataCenter.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } }),
    prisma.asset.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: [{ category: { displayOrder: "asc" } }, { displayOrder: "asc" }]
    })
  ]);
  const categories = rawCategories.map((category) => (
    category.code === "BACKUP"
      ? { ...category, assets: category.assets.filter((asset) => !isGeneratedBackupJobAssetCode(asset.code)) }
      : category
  ));
  const assets = rawAssets.filter((asset) => (
    asset.category.code === "BACKUP" ? !isGeneratedBackupJobAssetCode(asset.code) : true
  ));
  const assetOptions = filters.category === "all"
    ? assets
    : assets.filter((asset) => asset.category.code === filters.category);

  const assetsInScope = assets.filter((asset) => {
    if (filters.category !== "all" && asset.category.code !== filters.category) return false;
    if (filters.assetId !== "all" && asset.id !== filters.assetId) return false;
    return true;
  });
  const assetIdsInScope = new Set(assetsInScope.map((asset) => asset.id));
  const expectedDays = filters.mode === "daily" ? 1 : filters.maxDay;
  const expectedStatusRecords = assetsInScope.length * expectedDays;

  const assetWhere: Prisma.AssetWhereInput = {};
  if (filters.category !== "all") assetWhere.category = { code: filters.category };
  if (filters.assetId !== "all") assetWhere.id = filters.assetId;
  if (filters.category === "all" || filters.category === "BACKUP") {
    Object.assign(assetWhere, generatedBackupJobAssetExclusion("BACKUP"));
  }
  const slots = timeSlotsForShift(filters.shift);

  const statusEntryWhere: Prisma.DailyStatusEntryWhereInput = {
    reportId: report?.id ?? "__missing_report__",
    ...(filters.mode === "daily" ? { day: filters.day } : {}),
    ...(Object.keys(assetWhere).length > 0 ? { asset: assetWhere } : {}),
    ...(slots ? { timeSlot: { in: slots } } : {})
  };

  const metricWhere: Prisma.ServerMetricEntryWhereInput = {
    recordDate: dateFilter,
    ...(Object.keys(assetWhere).length > 0 ? { asset: assetWhere } : {}),
    ...(filters.shift !== "all"
      ? {
          OR: [
            { recordedShift: filters.shift as InspectionShift },
            ...(slots ? [{ recordedTimeSlot: { in: slots } }] : [])
          ]
        }
      : {})
  };

  const inspectionWhere: Prisma.DailyInspectionWhereInput = {
    inspectionDate: dateFilter,
    ...(filters.dataCenterId !== "all" ? { dataCenterId: filters.dataCenterId } : {}),
    ...(filters.shift !== "all" ? { inspectionShift: filters.shift as InspectionShift } : {})
  };

  const [statusEntriesRaw, metricEntriesRaw, inspectionsRaw] = await Promise.all([
    report
      ? prisma.dailyStatusEntry.findMany({
          where: statusEntryWhere,
          include: {
            asset: { include: { category: true } },
            recordedBy: { select: { displayName: true } },
            updatedBy: { select: { displayName: true } },
            report: { select: { month: true, buddhistYear: true } }
          },
          orderBy: [{ day: "desc" }, { updatedAt: "desc" }]
        })
      : Promise.resolve([]),
    prisma.serverMetricEntry.findMany({
      where: metricWhere,
      include: {
        asset: { include: { category: true } },
        disks: true,
        recordedBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } }
      },
      orderBy: [{ recordDate: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.dailyInspection.findMany({
      where: inspectionWhere,
      include: {
        dataCenter: true,
        results: {
          include: {
            checklistItem: { include: { category: true } }
          }
        }
      },
      orderBy: [{ inspectionDate: "desc" }, { timeSlot: "asc" }]
    })
  ]);

  const statusEntries = statusEntriesRaw.filter((entry) => statusFilterMatchesAsset(entry.statusCode, filters.status));
  const metricEntries = metricEntriesRaw.filter((entry) => statusFilterMatchesMetric(entry.overallStatus, filters.status));
  const inspectionResultRows = inspectionsRaw.flatMap((inspection) =>
    inspection.results
      .filter((result) => statusFilterMatchesInspection(result.status, filters.status))
      .map((result) => ({ inspection, result }))
  );

  const normalStatusCount = statusEntries.filter((entry) => entry.statusCode === "N").length;
  const warningStatusCount = statusEntries.filter((entry) => warningStatusCodes.includes(entry.statusCode)).length;
  const criticalStatusCount = statusEntries.filter((entry) => criticalStatusCodes.includes(entry.statusCode)).length;
  const statusIssueCount = statusEntries.length - normalStatusCount;
  const metricWarningCount = metricEntries.filter((entry) => entry.overallStatus === "WARNING").length;
  const metricCriticalCount = metricEntries.filter((entry) => entry.overallStatus === "CRITICAL").length;
  const inspectionAbnormalCount = inspectionResultRows.filter(({ result }) => result.status === "ABNORMAL").length;
  const inspectionNormalCount = inspectionResultRows.filter(({ result }) => result.status === "NORMAL").length;

  const allDisks = metricEntries.flatMap((entry) => entry.disks);
  const avgCpu = average(metricEntries.map((entry) => Number(entry.cpuPercent)));
  const avgRam = average(metricEntries.map((entry) => Number(entry.ramPercent)));
  const avgDisk = average(allDisks.map((disk) => Number(disk.percent)));
  const metricAssetsInScope = assetsInScope.filter((asset) => asset.category.code === "VM" || asset.category.code === "SERVER");
  const expectedMetricRecords = metricAssetsInScope.length * expectedDays;

  const categoryCards = categories
    .filter((category) => {
      if (filters.category !== "all" && category.code !== filters.category) return false;
      if (filters.assetId === "all") return true;
      return category.assets.some((asset) => asset.id === filters.assetId);
    })
    .map((category) => {
      const categoryAssetIds = new Set(category.assets.filter((asset) => assetIdsInScope.has(asset.id)).map((asset) => asset.id));
      const rows = statusEntries.filter((entry) => categoryAssetIds.has(entry.assetId));
      const expected = categoryAssetIds.size * expectedDays;
      const recorded = rows.length;
      return {
        code: category.code,
        label: categoryLabels[category.code],
        color: categoryColors[category.code],
        activeAssets: categoryAssetIds.size,
        recorded,
        expected,
        coveragePct: expected > 0 ? Math.round((recorded / expected) * 100) : 0,
        normal: rows.filter((entry) => entry.statusCode === "N").length,
        warning: rows.filter((entry) => warningStatusCodes.includes(entry.statusCode)).length,
        critical: rows.filter((entry) => criticalStatusCodes.includes(entry.statusCode)).length,
        daysRecorded: new Set(rows.map((entry) => entry.day)).size
      };
    });

  const trendMap = new Map<number, { day: number; date: string; statusRecords: number; issues: number; metrics: number; inspections: number }>();
  Array.from({ length: filters.maxDay }, (_, index) => index + 1).forEach((day) => {
    trendMap.set(day, { day, date: String(day), statusRecords: 0, issues: 0, metrics: 0, inspections: 0 });
  });
  statusEntries.forEach((entry) => {
    const row = trendMap.get(entry.day);
    if (!row) return;
    row.statusRecords += 1;
    if (entry.statusCode !== "N") row.issues += 1;
  });
  metricEntries.forEach((entry) => {
    const day = entry.recordDate.getDate();
    const row = trendMap.get(day);
    if (!row) return;
    row.metrics += 1;
    if (entry.overallStatus !== "NORMAL") row.issues += 1;
  });
  inspectionResultRows.forEach(({ inspection, result }) => {
    const row = trendMap.get(inspection.inspectionDate.getDate());
    if (!row) return;
    row.inspections += 1;
    if (result.status === "ABNORMAL") row.issues += 1;
  });
  const trendData = Array.from(trendMap.values()).filter((row) => filters.mode === "monthly" || row.day === filters.day);

  const resourceTrendMap = new Map<string, { date: string; cpuValues: number[]; ramValues: number[]; diskValues: number[] }>();
  metricEntries.forEach((entry) => {
    const key = dateKey(entry.recordDate);
    const row = resourceTrendMap.get(key) ?? {
      date: entry.recordDate.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" }),
      cpuValues: [],
      ramValues: [],
      diskValues: []
    };
    row.cpuValues.push(Number(entry.cpuPercent));
    row.ramValues.push(Number(entry.ramPercent));
    row.diskValues.push(...entry.disks.map((disk) => Number(disk.percent)));
    resourceTrendMap.set(key, row);
  });
  const resourceTrend = Array.from(resourceTrendMap.values()).map((row) => ({
    date: row.date,
    cpu: average(row.cpuValues),
    ram: average(row.ramValues),
    disk: average(row.diskValues)
  }));

  const metricServerOptions = Array.from(
    new Map(metricEntries.map((entry) => [entry.assetId, { id: entry.assetId, name: entry.asset.name }])).values()
  ).map((server, index) => ({ ...server, color: metricTrendColors[index % metricTrendColors.length] }));
  const diskTrendMap = new Map<string, { date: string } & Record<string, string | number>>();
  metricEntries.forEach((entry) => {
    const mainDisk = entry.disks[0];
    if (!mainDisk) return;
    const key = `${entry.recordDate.toISOString()}-${entry.assetId}`;
    const row = diskTrendMap.get(key) ?? {
      date: entry.recordDate.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" })
    };
    row[entry.assetId] = Number(mainDisk.percent);
    diskTrendMap.set(key, row);
  });
  const diskTrend = Array.from(diskTrendMap.values());
  const diskTrendSeries = metricServerOptions.map((server) => ({ key: server.id, name: server.name, color: server.color }));

  const uniqueInspectionIds = new Set(inspectionResultRows.map(({ inspection }) => inspection.id));
  const shiftSummary = inspectionShiftOrder.map((shift) => {
    const statusRows = statusEntries.filter((entry) => getShiftForTimeSlot(entry.timeSlot) === shift);
    const inspectionRows = inspectionResultRows.filter(({ inspection }) => inspection.inspectionShift === shift);
    const inspectionByCategory = new Map<string, { normal: number; abnormal: number }>();
    inspectionRows.forEach(({ result }) => {
      const catName = result.checklistItem.category.name;
      const cat = inspectionByCategory.get(catName) ?? { normal: 0, abnormal: 0 };
      if (result.status === "NORMAL") cat.normal += 1;
      else cat.abnormal += 1;
      inspectionByCategory.set(catName, cat);
    });
    return {
      shift,
      label: inspectionShiftLabels[shift],
      fullLabel: inspectionShiftFullLabels[shift],
      statusRecords: statusRows.length,
      statusIssues: statusRows.filter((entry) => entry.statusCode !== "N").length,
      inspections: new Set(inspectionRows.map(({ inspection }) => inspection.id)).size,
      inspectionByCategory: Array.from(inspectionByCategory.entries()).map(([name, counts]) => ({
        name, ...counts
      })),
      normal: inspectionRows.filter(({ result }) => result.status === "NORMAL").length,
      abnormal: inspectionRows.filter(({ result }) => result.status === "ABNORMAL").length
    };
  });

  const environmentDashboard = dataCenters.map((dataCenter) => ({
    id: dataCenter.id,
    name: dataCenter.name,
    shifts: inspectionShiftOrder.map((shift) => {
      const inspectionsForShift = inspectionsRaw
        .filter((inspection) => inspection.dataCenterId === dataCenter.id && inspection.inspectionShift === shift)
        .sort((a, b) => {
          const aTime = (a.inspectionCompletedAt ?? a.updatedAt).getTime();
          const bTime = (b.inspectionCompletedAt ?? b.updatedAt).getTime();
          return bTime - aTime;
        });
      const inspection = inspectionsForShift[0];
      const abnormalCount = inspection?.results.filter((result) => result.status === "ABNORMAL").length ?? 0;
      const durationMin = inspection?.inspectionStartedAt && inspection.inspectionCompletedAt
        ? Math.max(0, Math.round((inspection.inspectionCompletedAt.getTime() - inspection.inspectionStartedAt.getTime()) / 60_000))
        : null;

      return {
        shift,
        label: inspectionShiftLabels[shift],
        inspectorName: inspection?.inspectorName ?? "-",
        startedAt: inspection?.inspectionStartedAt ? formatDisplayDateTime(inspection.inspectionStartedAt) : "-",
        completedAt: inspection?.inspectionCompletedAt ? formatDisplayDateTime(inspection.inspectionCompletedAt) : "-",
        durationMin,
        abnormalCount,
        status: inspection ? (abnormalCount > 0 ? "WARNING" : "NORMAL") : "PENDING"
      };
    })
  }));

  const infrastructureDashboard = categoryCards.map((category) => ({
    code: category.code,
    label: category.label,
    total: category.activeAssets,
    recorded: category.recorded,
    remaining: Math.max(category.expected - category.recorded, 0),
    progressPct: category.coveragePct,
    warning: category.warning,
    critical: category.critical
  }));

  const inspectionRoundCount = inspectionsRaw.length;
  const totalInspectionMinutes = inspectionsRaw.reduce((sum, inspection) => {
    if (!inspection.inspectionStartedAt || !inspection.inspectionCompletedAt) return sum;
    return sum + Math.max(0, Math.round((inspection.inspectionCompletedAt.getTime() - inspection.inspectionStartedAt.getTime()) / 60_000));
  }, 0);
  const averageInspectionMinutes = inspectionRoundCount > 0
    ? Math.round((totalInspectionMinutes / inspectionRoundCount) * 100) / 100
    : 0;
  const inspectionCheckedCount = inspectionResultRows.length;
  const inspectionAbnormalItems = inspectionResultRows.filter(({ result }) => result.status === "ABNORMAL").length;
  const expectedInspectionItems = inspectionsRaw.reduce((sum, inspection) => sum + inspection.results.length, 0);
  const inspectionCompletionPct = expectedInspectionItems > 0
    ? Math.round((inspectionCheckedCount / expectedInspectionItems) * 100)
    : (inspectionRoundCount > 0 ? 100 : 0);

  const infrastructureKpi = {
    inspectionRoundCount,
    totalInspectionMinutes,
    averageInspectionMinutes,
    checkedCount: inspectionCheckedCount,
    completionPct: inspectionCompletionPct,
    abnormalCount: inspectionAbnormalItems
  };

  const inspectorKpi = new Map<string, {
    inspectorName: string;
    workCount: number;
    assetCount: number;
    inspectionRounds: number;
    warning: number;
    critical: number;
    totalDurationMin: number;
    durationCount: number;
  }>();
  const ensureInspector = (name: string) => {
    const key = name || "-";
    const current = inspectorKpi.get(key);
    if (current) return current;
    const next = {
      inspectorName: key,
      workCount: 0,
      assetCount: 0,
      inspectionRounds: 0,
      warning: 0,
      critical: 0,
      totalDurationMin: 0,
      durationCount: 0
    };
    inspectorKpi.set(key, next);
    return next;
  };

  statusEntries.forEach((entry) => {
    const kpi = ensureInspector(entry.updatedBy?.displayName ?? entry.recordedBy?.displayName ?? "-");
    kpi.workCount += 1;
    kpi.assetCount += 1;
    if (warningStatusCodes.includes(entry.statusCode)) kpi.warning += 1;
    if (criticalStatusCodes.includes(entry.statusCode)) kpi.critical += 1;
  });
  inspectionsRaw.forEach((inspection) => {
    const kpi = ensureInspector(inspection.inspectorName);
    const abnormal = inspection.results.filter((result) => result.status === "ABNORMAL").length;
    kpi.workCount += 1;
    kpi.inspectionRounds += 1;
    kpi.warning += abnormal;
    if (inspection.inspectionStartedAt && inspection.inspectionCompletedAt) {
      kpi.totalDurationMin += Math.max(0, Math.round((inspection.inspectionCompletedAt.getTime() - inspection.inspectionStartedAt.getTime()) / 60_000));
      kpi.durationCount += 1;
    }
  });
  const kpiDashboard = Array.from(inspectorKpi.values())
    .map((kpi) => ({
      ...kpi,
      averageDurationMin: kpi.durationCount > 0 ? Math.round(kpi.totalDurationMin / kpi.durationCount) : 0,
      completionPct: expectedStatusRecords > 0 ? Math.min(100, Math.round((kpi.assetCount / expectedStatusRecords) * 100)) : 0
    }))
    .sort((a, b) => b.workCount - a.workCount)
    .slice(0, 8);

  const topIssues = [
    ...statusEntries
      .filter((entry) => entry.statusCode !== "N")
      .map((entry) => ({
        source: "บันทึกสถานะทรัพย์สิน",
        title: entry.asset.name,
        category: categoryLabels[entry.asset.category.code],
        status: rowStatusLabel(entry.statusCode),
        note: entry.note ?? "",
        updatedAt: entry.updatedAt
      })),
    ...metricEntries
      .filter((entry) => entry.overallStatus !== "NORMAL")
      .map((entry) => ({
        source: "ค่าทรัพยากรเซิร์ฟเวอร์",
        title: entry.asset.name,
        category: categoryLabels[entry.asset.category.code],
        status: rowStatusLabel(entry.overallStatus),
        note: entry.note ?? "",
        updatedAt: entry.updatedAt
      })),
    ...inspectionResultRows
      .filter(({ result }) => result.status === "ABNORMAL")
      .map(({ inspection, result }) => ({
        source: "ตรวจห้อง Data Center",
        title: result.checklistItem.name,
        category: result.checklistItem.category.name,
        status: rowStatusLabel(result.status),
        note: result.note ?? "",
        updatedAt: inspection.updatedAt
      }))
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const topCpu = metricEntries
    .map((entry) => ({ assetName: entry.asset.name, percent: Number(entry.cpuPercent), status: entry.cpuStatus }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);
  const topRam = metricEntries
    .map((entry) => ({ assetName: entry.asset.name, percent: Number(entry.ramPercent), status: entry.ramStatus }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);
  const topDisk = metricEntries
    .flatMap((entry) => entry.disks.map((disk) => ({
      assetName: entry.asset.name,
      diskName: disk.diskName,
      percent: Number(disk.percent),
      status: disk.status
    })))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);

  const rawRows: DashboardRawRow[] = [
    ...statusEntries.map((entry) => {
      const entryDate = dayDate(entry.report.buddhistYear - 543, entry.report.month, entry.day);
      return {
        source: "บันทึกสถานะทรัพย์สิน" as const,
        date: formatDisplayDate(entryDate),
        category: categoryLabels[entry.asset.category.code],
        item: entry.asset.name,
        status: rowStatusLabel(entry.statusCode),
        note: entry.note ?? "",
        operator: entry.updatedBy?.displayName ?? entry.recordedBy?.displayName ?? "-",
        shift: inspectionShiftLabels[getShiftForTimeSlot(entry.timeSlot)],
        timeSlot: timeSlotLabel(entry.timeSlot),
        dataCenter: "",
        cpu: "",
        ram: "",
        disk: "",
        updatedAt: formatDisplayDateTime(entry.updatedAt)
      };
    }),
    ...metricEntries.map((entry) => {
      const diskText = entry.disks.map((disk) => `${disk.diskName}: ${Number(disk.usedGb)}/${Number(disk.totalGb)} GB (${Number(disk.percent)}%)`).join("; ");
      return {
        source: "ค่าทรัพยากรเซิร์ฟเวอร์" as const,
        date: formatDisplayDate(entry.recordDate),
        category: categoryLabels[entry.asset.category.code],
        item: entry.asset.name,
        status: rowStatusLabel(entry.overallStatus),
        note: entry.note ?? "",
        operator: entry.updatedBy?.displayName ?? entry.recordedBy?.displayName ?? "-",
        shift: entry.recordedShift ? inspectionShiftLabels[entry.recordedShift as InspectionShiftKey] : "",
        timeSlot: timeSlotLabel(entry.recordedTimeSlot),
        dataCenter: "",
        cpu: `${Number(entry.cpuPercent)}%`,
        ram: `${Number(entry.ramUsedGb)} / ${Number(entry.ramTotalGb)} GB (${Number(entry.ramPercent)}%)`,
        disk: diskText,
        updatedAt: formatDisplayDateTime(entry.updatedAt)
      };
    }),
    ...inspectionResultRows.map(({ inspection, result }) => ({
      source: "ตรวจห้อง Data Center" as const,
      date: formatDisplayDate(inspection.inspectionDate),
      category: result.checklistItem.category.name,
      item: result.checklistItem.name,
      status: rowStatusLabel(result.status),
      note: result.note ?? "",
      operator: inspection.inspectorName,
      shift: inspectionShiftLabels[inspection.inspectionShift as InspectionShiftKey],
      timeSlot: timeSlotLabel(inspection.timeSlot),
      dataCenter: inspection.dataCenter.name,
      cpu: "",
      ram: result.temperature === null ? "" : `${Number(result.temperature)} C`,
      disk: result.humidity === null ? "" : `${Number(result.humidity)}% RH`,
      updatedAt: formatDisplayDateTime(result.updatedAt)
    }))
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const statusByCategory = categories
    .filter((cat) => cat.assets.some((asset) => assetIdsInScope.has(asset.id)))
    .map((category) => {
      const categoryAssets = category.assets.filter((asset) => assetIdsInScope.has(asset.id));
      const assetIds = new Set(categoryAssets.map((a) => a.id));
      const entries = statusEntries.filter((e) => assetIds.has(e.assetId));
      const codes = allowedStatusCodes(category.code);
      const statusCounts: Record<string, number> = {};
      codes.forEach((code) => { statusCounts[code] = 0; });
      entries.forEach((e) => {
        if (statusCounts[e.statusCode] !== undefined) {
          statusCounts[e.statusCode] += 1;
        }
      });
      return {
        code: category.code,
        label: categoryLabels[category.code],
        total: categoryAssets.length,
        recorded: entries.length,
        codes,
        statusCounts
      };
    });

  return {
    period,
    report,
    hasReport: Boolean(report),
    categories,
    dataCenters,
    assetOptions,
    statusByCategory,
    statusOptions: buildStatusOptionsForCategory(filters.category, categories),
    summary: {
      dataCenterCount: dataCenters.length,
      assetCount: assetsInScope.length,
      completedCount: statusEntries.length + uniqueInspectionIds.size + metricEntries.length,
      remainingCount: Math.max(expectedStatusRecords - statusEntries.length, 0) + Math.max(expectedMetricRecords - metricEntries.length, 0),
      expectedStatusRecords,
      recordedStatusRecords: statusEntries.length,
      coveragePct: expectedStatusRecords > 0 ? Math.round((statusEntries.length / expectedStatusRecords) * 100) : 0,
      normalStatusCount,
      warningStatusCount,
      criticalStatusCount,
      statusIssueCount,
      inspectionCount: uniqueInspectionIds.size,
      inspectionResultCount: inspectionResultRows.length,
      inspectionNormalCount,
      inspectionAbnormalCount,
      metricCount: metricEntries.length,
      expectedMetricRecords,
      metricCoveragePct: expectedMetricRecords > 0 ? Math.round((metricEntries.length / expectedMetricRecords) * 100) : 0,
      avgCpu,
      avgRam,
      avgDisk,
      metricWarningCount,
      metricCriticalCount,
      criticalCount: criticalStatusCount + metricCriticalCount,
      warningCount: warningStatusCount + metricWarningCount + inspectionAbnormalCount,
      totalIssues: statusIssueCount + metricWarningCount + metricCriticalCount + inspectionAbnormalCount
    },
    categoryCards,
    environmentDashboard,
    infrastructureDashboard,
    infrastructureKpi,
    kpiDashboard,
    trendData,
    resourceTrend,
    diskTrend,
    diskTrendSeries,
    shiftSummary,
    topIssues,
    topCpu,
    topRam,
    topDisk,
    rawRows,
    missionProgress: await getMissionProgress({
      dataCenters,
      inspectionsRaw,
      statusEntries,
      filters,
      categories
    })
  };
}

// ─── Mission Progress ────────────────────────────────────────────────────────

export type MissionPolicyProgress = {
  policyId:        string;
  categoryKey:     string;
  categoryLabel:   string;
  requiredShifts:  string;
  minRoundsPerDay: number;
  required:        number;
  done:            number;
  remaining:       number;
  pct:             number;
};

export type MissionProgress = {
  hasPolicies: boolean;
  dayCount:    number;
  dcCount:     number;
  policies:    MissionPolicyProgress[];
  totalRequired: number;
  totalDone:     number;
  totalPct:      number;
};

async function getMissionProgress({
  dataCenters,
  inspectionsRaw,
  statusEntries,
  filters,
  categories
}: {
  dataCenters:    Awaited<ReturnType<typeof prisma.dataCenter.findMany>>;
  inspectionsRaw: Awaited<ReturnType<typeof prisma.dailyInspection.findMany<{ include: { dataCenter: true; results: { include: { checklistItem: { include: { category: true } } } } } }>>>;
  statusEntries:  { asset: { category: { code: AssetCategoryCode } }; day: number; assetId: string; [key: string]: unknown }[];
  filters:        DashboardFilters;
  categories:     Awaited<ReturnType<typeof prisma.assetCategory.findMany<{ include: { assets: true } }>>>;
}): Promise<MissionProgress> {
  const policies = await (prisma as any).inspectionPolicy.findMany({
    where:   { active: true },
    orderBy: [{ displayOrder: "asc" }, { categoryKey: "asc" }]
  }) as {
    id: string; categoryKey: string; categoryLabel: string;
    minRoundsPerDay: number; requiredShifts: string; active: boolean;
  }[];

  if (policies.length === 0) {
    return { hasPolicies: false, dayCount: 0, dcCount: 0, policies: [], totalRequired: 0, totalDone: 0, totalPct: 0 };
  }

  const dayCount = filters.mode === "daily" ? 1 : filters.maxDay;
  const dcCount  = dataCenters.length;

  // Build assetCount per categoryKey (active assets only, matching category code)
  const assetCountByCode = new Map<string, number>();
  categories.forEach((cat) => {
    assetCountByCode.set(cat.code, cat.assets.filter((a) => a.active).length);
  });

  // Asset policies: count unique (assetId, day) rounds
  const assetRoundSet = new Set<string>();
  statusEntries.forEach((e) => {
    assetRoundSet.add(`${e.asset.category.code}::${e.assetId}::${e.day}`);
  });

  // DC_ROOM policy: count unique (dataCenterId, timeSlot) from inspectionsRaw
  const dcRoomRoundSet = new Set<string>();
  inspectionsRaw.forEach((insp) => {
    dcRoomRoundSet.add(`${insp.dataCenterId}::${insp.timeSlot}`);
  });

  const policyRows: MissionPolicyProgress[] = policies.map((p) => {
    let required = 0;
    let done     = 0;

    if (p.categoryKey === "DC_ROOM") {
      // required = minRoundsPerDay × days × dataCenters
      required = p.minRoundsPerDay * dayCount * dcCount;
      done     = dcRoomRoundSet.size;
    } else {
      // required = minRoundsPerDay × days × activeAssetsInCategory
      const assetCount = assetCountByCode.get(p.categoryKey) ?? 0;
      required = p.minRoundsPerDay * dayCount * assetCount;
      // done = unique (assetId, day) rounds for this category
      const catDone = new Set<string>();
      assetRoundSet.forEach((key) => {
        if (key.startsWith(p.categoryKey + "::")) catDone.add(key);
      });
      done = catDone.size;
    }

    const pct = required > 0 ? Math.min(100, Math.round((done / required) * 100)) : (done > 0 ? 100 : 0);
    return {
      policyId:        p.id,
      categoryKey:     p.categoryKey,
      categoryLabel:   p.categoryLabel,
      requiredShifts:  p.requiredShifts,
      minRoundsPerDay: p.minRoundsPerDay,
      required,
      done,
      remaining:       Math.max(required - done, 0),
      pct
    };
  });

  const totalRequired = policyRows.reduce((s, r) => s + r.required, 0);
  const totalDone     = policyRows.reduce((s, r) => s + r.done,     0);
  const totalPct      = totalRequired > 0 ? Math.min(100, Math.round((totalDone / totalRequired) * 100)) : 0;

  return { hasPolicies: true, dayCount, dcCount, policies: policyRows, totalRequired, totalDone, totalPct };
}

function csvEscape(value: string | number) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildDashboardCsv(rows: DashboardRawRow[]) {
  const header = [
    "แหล่งข้อมูล",
    "วันที่",
    "หมวด",
    "รายการ",
    "สถานะ",
    "หมายเหตุ",
    "ผู้บันทึก",
    "เวร",
    "ช่วงเวลา",
    "Data Center",
    "CPU",
    "RAM/อุณหภูมิ",
    "Disk/ความชื้น",
    "อัปเดตล่าสุด"
  ];
  const body = rows.map((row) => [
    row.source,
    row.date,
    row.category,
    row.item,
    row.status,
    row.note,
    row.operator,
    row.shift,
    row.timeSlot,
    row.dataCenter,
    row.cpu,
    row.ram,
    row.disk,
    row.updatedAt
  ]);

  return "\uFEFF" + [header, ...body].map((line) => line.map(csvEscape).join(",")).join("\r\n");
}

export function dashboardExportFilename(filters: DashboardFilters) {
  const mode = filters.mode === "daily"
    ? `${filters.buddhistYear}-${String(filters.month).padStart(2, "0")}-${String(filters.day).padStart(2, "0")}`
    : `${filters.buddhistYear}-${String(filters.month).padStart(2, "0")}`;
  return `data-center-dashboard-${filters.mode}-${mode}.csv`;
}
