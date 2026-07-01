import { prisma } from "@/lib/prisma";
import { daysInThaiMonth } from "@/lib/date";
import { generatedBackupJobAssetExclusion } from "@/lib/assets";
import type { AssetCategoryCode } from "@prisma/client";

const generatedBackupJobAssetRelationExclusion = generatedBackupJobAssetExclusion("BACKUP");

function activeAssetWhereForCategory(code: AssetCategoryCode) {
  return {
    active: true,
    category: { code },
    ...generatedBackupJobAssetExclusion(code),
  };
}

function assetRelationWhereForCategory(code: AssetCategoryCode) {
  return {
    category: { code },
    ...generatedBackupJobAssetExclusion(code),
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyReportSummary {
  reportId: string;
  month: number;
  buddhistYear: number;
  totalDays: number;
  generatedAt: Date;
  executive: ExecutiveSummary;
  categoryRows: CategoryRow[];
  dataCenterRows: DataCenterRow[];
  shiftRows: ShiftRow[];
  workloadRows: WorkloadRow[];
  incidentSummary: IncidentSummary;
  dcRoomSummary: DCRoomSummary;
  dcRoomDetails: DcRoomDetail[];
}

export interface ExecutiveSummary {
  totalDataCenters: number;
  totalInspectionCategories: number;
  totalAssets: number;
  totalExpectedRounds: number;
  totalRecordedRounds: number;
  compliancePct: number;
  warningCount: number;
  criticalCount: number;
  remainingRounds: number;
  activeUserCount: number;
}

export interface CategoryRow {
  key: string;
  label: string;
  expected: number;
  recorded: number;
  remaining: number;
  warningCount: number;
  criticalCount: number;
  compliancePct: number;
}

export interface DataCenterRow {
  id: string;
  name: string;
  rounds: number;
  compliancePct: number;
  warningCount: number;
  criticalCount: number;
}

export interface ShiftRow {
  shift: string;
  label: string;
  expected: number;
  recorded: number;
  compliancePct: number;
}

export interface WorkloadRow {
  userId: string;
  name: string;
  rounds: number;
  items: number;
  totalMin: number;
  avgMinPerRound: number;
  avgMinPerItem: number;
  categories: string[];
}

export interface IncidentSummary {
  total: number;
  warningItems: Array<{ assetName: string; day: number; statusCode: string; note: string | null }>;
  criticalItems: Array<{ assetName: string; day: number; statusCode: string; note: string | null }>;
}

export interface DCRoomSummary {
  totalRounds: number;
  avgTemperature: number | null;
  avgHumidity: number | null;
  alarmCount: number;
  abnormalCount: number;
}

export interface DcRoomDetail {
  id: string;
  name: string;
  rounds: number;
  abnormalCount: number;
  avgTemperature: number | null;
  avgHumidity: number | null;
}

// ─── Main aggregator ─────────────────────────────────────────────────────────

export async function buildMonthlyReportData(reportId: string): Promise<MonthlyReportSummary | null> {
  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report) return null;

  const { month, buddhistYear } = report;
  const totalDays = daysInThaiMonth(month, buddhistYear);
  const gregStart = new Date(buddhistYear - 543, month - 1, 1);
  const gregEnd   = new Date(buddhistYear - 543, month, 0, 23, 59, 59, 999);

  const [
    executive,
    categoryRows,
    dataCenterRows,
    shiftRows,
    workloadRows,
    incidentSummary,
    dcRoomSummary,
    dcRoomDetails,
  ] = await Promise.all([
    buildExecutiveSummary(reportId, month, buddhistYear, totalDays, gregStart, gregEnd),
    buildCategoryRows(reportId, month, buddhistYear, totalDays),
    buildDataCenterRows(gregStart, gregEnd),
    buildShiftRows(reportId),
    buildWorkloadRows(reportId),
    buildIncidentSummary(reportId),
    buildDCRoomSummary(gregStart, gregEnd),
    buildDCRoomDetails(gregStart, gregEnd),
  ]);

  return {
    reportId,
    month,
    buddhistYear,
    totalDays,
    generatedAt: new Date(),
    executive,
    categoryRows,
    dataCenterRows,
    shiftRows,
    workloadRows,
    incidentSummary,
    dcRoomSummary,
    dcRoomDetails,
  };
}

// ─── Executive Summary ───────────────────────────────────────────────────────

async function buildExecutiveSummary(
  reportId: string, month: number, buddhistYear: number, totalDays: number,
  gregStart: Date, gregEnd: Date
): Promise<ExecutiveSummary> {
  const [
    assetCategories,
    entries,
    dataCenters,
    inspectors,
    warningCount,
    criticalCount,
  ] = await Promise.all([
    prisma.assetCategory.findMany({ select: { code: true } }),
    prisma.dailyStatusEntry.findMany({
      where: { reportId, asset: generatedBackupJobAssetRelationExclusion },
      select: { statusCode: true, recordedById: true, updatedById: true }
    }),
    prisma.dataCenter.count({ where: { active: true } }),
    prisma.dailyStatusEntry.findMany({
      where: { reportId, NOT: { updatedById: null }, asset: generatedBackupJobAssetRelationExclusion },
      select: { updatedById: true },
      distinct: ["updatedById"]
    }),
    prisma.dailyStatusEntry.count({
      where: { reportId, asset: generatedBackupJobAssetRelationExclusion, statusCode: { not: "N" } }
    }),
    prisma.dailyStatusEntry.count({
      where: { reportId, asset: generatedBackupJobAssetRelationExclusion, statusCode: "F" }
    }),
  ]);

  const categoryAssetCounts = await Promise.all(
    assetCategories.map((category) => prisma.asset.count({
      where: activeAssetWhereForCategory(category.code as AssetCategoryCode),
    }))
  );
  const totalAssets = categoryAssetCounts.reduce((sum, count) => sum + count, 0);
  const totalExpected = totalAssets * totalDays;
  const totalRecorded = entries.length;
  const compliancePct = totalExpected > 0 ? Math.round((totalRecorded / totalExpected) * 100) : 0;

  return {
    totalDataCenters: dataCenters,
    totalInspectionCategories: assetCategories.length,
    totalAssets,
    totalExpectedRounds: totalExpected,
    totalRecordedRounds: totalRecorded,
    compliancePct: Math.min(compliancePct, 100),
    warningCount,   // abnormal entries (statusCode != N)
    criticalCount,  // failed entries (statusCode = F)
    remainingRounds: Math.max(0, totalExpected - totalRecorded),
    activeUserCount: inspectors.length,
  };
}

// ─── Category Rows ───────────────────────────────────────────────────────────

async function buildCategoryRows(
  reportId: string, month: number, buddhistYear: number, totalDays: number
): Promise<CategoryRow[]> {
  const policies = await (prisma as any).inspectionPolicy.findMany({
    where: { active: true },
    orderBy: { displayOrder: "asc" },
  }) as Array<{ id: string; categoryKey: string; categoryLabel: string }>;

  const assetCategories = await prisma.assetCategory.findMany({
    select: { code: true }
  });
  const assetCountEntries = await Promise.all(
    assetCategories.map(async (category) => [
      category.code,
      await prisma.asset.count({ where: activeAssetWhereForCategory(category.code as AssetCategoryCode) }),
    ] as const)
  );
  const assetCountByCode = new Map(assetCountEntries);

  const rows: CategoryRow[] = [];
  for (const policy of policies) {
    const assetCount = assetCountByCode.get(policy.categoryKey as AssetCategoryCode) ?? 0;
    const expected = assetCount * totalDays;

    const isAssetCategory = ["VM", "SERVER", "NETWORK", "STORAGE", "BACKUP"].includes(policy.categoryKey);
    if (isAssetCategory) {
      const catCode = policy.categoryKey as AssetCategoryCode;
      const [recorded, warningCount, criticalCount] = await Promise.all([
        prisma.dailyStatusEntry.count({
          where: { reportId, asset: assetRelationWhereForCategory(catCode) }
        }),
        prisma.dailyStatusEntry.count({
          where: { reportId, asset: assetRelationWhereForCategory(catCode), statusCode: { not: "N" } }
        }),
        prisma.dailyStatusEntry.count({
          where: { reportId, asset: assetRelationWhereForCategory(catCode), statusCode: "F" }
        }),
      ]);
      const compliancePct = expected > 0 ? Math.min(100, Math.round((recorded / expected) * 100)) : 0;
      rows.push({
        key: policy.categoryKey,
        label: policy.categoryLabel,
        expected,
        recorded,
        remaining: Math.max(0, expected - recorded),
        warningCount,
        criticalCount,
        compliancePct,
      });
    } else {
      // DC Room or other types
      rows.push({
        key: policy.categoryKey,
        label: policy.categoryLabel,
        expected: 0,
        recorded: 0,
        remaining: 0,
        warningCount: 0,
        criticalCount: 0,
        compliancePct: 0,
      });
    }
  }

  return rows;
}

// ─── Data Center Rows ────────────────────────────────────────────────────────

async function buildDataCenterRows(gregStart: Date, gregEnd: Date): Promise<DataCenterRow[]> {
  const dataCenters = await prisma.dataCenter.findMany({
    where: { active: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true }
  });

  const rows: DataCenterRow[] = [];
  for (const dc of dataCenters) {
    const inspections = await prisma.dailyInspection.findMany({
      where: { dataCenterId: dc.id, inspectionDate: { gte: gregStart, lte: gregEnd } },
      select: { id: true }
    });
    const inspectionIds = inspections.map((i) => i.id);
    const rounds = inspections.length;

    const [totalResults, abnormalResults] = await Promise.all([
      prisma.inspectionResult.count({ where: { dailyInspectionId: { in: inspectionIds } } }),
      prisma.inspectionResult.count({
        where: { dailyInspectionId: { in: inspectionIds }, status: "ABNORMAL" }
      }),
    ]);

    const compliancePct = totalResults > 0
      ? Math.min(100, Math.round(((totalResults - abnormalResults) / totalResults) * 100))
      : 0;

    rows.push({ id: dc.id, name: dc.name, rounds, compliancePct, warningCount: 0, criticalCount: abnormalResults });
  }

  return rows;
}

// ─── Shift Rows ──────────────────────────────────────────────────────────────

async function buildShiftRows(reportId: string): Promise<ShiftRow[]> {
  const SHIFTS = [
    { shift: "OFFICE_HOURS",    label: "เวลาราชการ" },
    { shift: "MORNING_SHIFT",   label: "เวรเช้า" },
    { shift: "AFTERNOON_SHIFT", label: "เวรบ่าย" },
    { shift: "NIGHT_SHIFT",     label: "เวรดึก" },
  ];

  const rows: ShiftRow[] = [];
  for (const s of SHIFTS) {
    const [recorded] = await Promise.all([
      prisma.dailyStatusEntry.count({
        where: { reportId, inspectionShift: s.shift as any }
      }),
    ]);
    rows.push({
      shift: s.shift,
      label: s.label,
      expected: 0,
      recorded,
      compliancePct: 0,
    });
  }
  return rows;
}

// ─── Workload Rows ───────────────────────────────────────────────────────────

async function buildWorkloadRows(reportId: string): Promise<WorkloadRow[]> {
  const entries = await prisma.dailyStatusEntry.findMany({
    where: { reportId, NOT: { updatedById: null } },
    include: {
      asset: { select: { category: { select: { name: true } } } }
    }
  });

  const userMap = new Map<string, {
    name: string; rounds: number; items: number; totalMin: number; categories: Set<string>
  }>();

  const userIds = [...new Set(entries.map((e) => e.updatedById!))].filter(Boolean) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true }
  });
  const userNameMap = new Map(users.map((u) => [u.id, u.displayName]));

  for (const e of entries) {
    const uid = e.updatedById!;
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        name: userNameMap.get(uid) ?? uid,
        rounds: 0, items: 0, totalMin: 0, categories: new Set()
      });
    }
    const row = userMap.get(uid)!;
    row.items++;
    row.totalMin += (e as any).durationMinutes ?? 0;
    const catName = (e as any).asset?.category?.name;
    if (catName) row.categories.add(catName);
  }

  // Count unique rounds per user (unique day+shift combos)
  const roundsQuery = await prisma.dailyStatusEntry.groupBy({
    by: ["updatedById", "day", "inspectionShift"],
    where: { reportId, NOT: { updatedById: null } },
    _count: { id: true }
  });
  for (const rq of roundsQuery) {
    const uid = rq.updatedById!;
    if (userMap.has(uid)) userMap.get(uid)!.rounds++;
  }

  return [...userMap.entries()]
    .map(([uid, v]) => ({
      userId: uid,
      name: v.name,
      rounds: v.rounds,
      items: v.items,
      totalMin: v.totalMin,
      avgMinPerRound: v.rounds > 0 ? Math.round(v.totalMin / v.rounds) : 0,
      avgMinPerItem: v.items > 0 ? Math.round(v.totalMin / v.items) : 0,
      categories: [...v.categories],
    }))
    .sort((a, b) => b.items - a.items);
}

// ─── Incident Summary ─────────────────────────────────────────────────────────

async function buildIncidentSummary(reportId: string): Promise<IncidentSummary> {
  const abnormalEntries = await prisma.dailyStatusEntry.findMany({
    where: { reportId, statusCode: { not: "N" } },
    include: { asset: { select: { name: true } } },
    orderBy: { day: "asc" },
    take: 100,
  });

  const allItems = abnormalEntries.map((e) => ({
    assetName: (e as any).asset?.name ?? e.assetId,
    day: e.day,
    statusCode: String(e.statusCode),
    note: e.note ?? null,
  }));

  const warningItems = allItems.filter((i) => i.statusCode !== "F");
  const criticalItems = allItems.filter((i) => i.statusCode === "F");

  return {
    total: warningItems.length + criticalItems.length,
    warningItems,
    criticalItems,
  };
}

// ─── DC Room Summary ─────────────────────────────────────────────────────────

async function buildDCRoomSummary(gregStart: Date, gregEnd: Date): Promise<DCRoomSummary> {
  const inspections = await prisma.dailyInspection.findMany({
    where: { inspectionDate: { gte: gregStart, lte: gregEnd } },
    select: { id: true }
  });
  const inspectionIds = inspections.map((i) => i.id);

  const [results, abnormalCount] = await Promise.all([
    prisma.inspectionResult.findMany({
      where: { dailyInspectionId: { in: inspectionIds } },
      select: { temperature: true, humidity: true, status: true }
    }),
    prisma.inspectionResult.count({
      where: { dailyInspectionId: { in: inspectionIds }, status: { not: "NORMAL" as any } }
    }),
  ]);

  const temps = results.map((r) => r.temperature ? Number(r.temperature) : null).filter((v): v is number => v !== null);
  const hums = results.map((r) => r.humidity ? Number(r.humidity) : null).filter((v): v is number => v !== null);

  const avgTemp = temps.length > 0 ? Math.round((temps.reduce((s, v) => s + v, 0) / temps.length) * 10) / 10 : null;
  const avgHum  = hums.length  > 0 ? Math.round((hums.reduce((s, v) => s + v, 0) / hums.length) * 10) / 10  : null;

  const alarmCount = await prisma.inspectionResult.count({
    where: { dailyInspectionId: { in: inspectionIds }, status: "ABNORMAL" }
  });

  return {
    totalRounds: inspections.length,
    avgTemperature: avgTemp,
    avgHumidity: avgHum,
    alarmCount,
    abnormalCount,
  };
}

// ─── DC Room Details (per Data Center) ──────────────────────────────────────

async function buildDCRoomDetails(gregStart: Date, gregEnd: Date): Promise<DcRoomDetail[]> {
  const dataCenters = await prisma.dataCenter.findMany({
    where: { active: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true }
  });

  const details: DcRoomDetail[] = [];
  for (const dc of dataCenters) {
    const inspections = await prisma.dailyInspection.findMany({
      where: { dataCenterId: dc.id, inspectionDate: { gte: gregStart, lte: gregEnd } },
      select: { id: true }
    });
    const inspectionIds = inspections.map((i) => i.id);

    if (inspectionIds.length === 0) {
      details.push({ id: dc.id, name: dc.name, rounds: 0, abnormalCount: 0, avgTemperature: null, avgHumidity: null });
      continue;
    }

    const [results, abnormalCount] = await Promise.all([
      prisma.inspectionResult.findMany({
        where: { dailyInspectionId: { in: inspectionIds } },
        select: { temperature: true, humidity: true }
      }),
      prisma.inspectionResult.count({
        where: { dailyInspectionId: { in: inspectionIds }, status: "ABNORMAL" }
      }),
    ]);

    const temps = results.map((r) => r.temperature ? Number(r.temperature) : null).filter((v): v is number => v !== null);
    const hums  = results.map((r) => r.humidity    ? Number(r.humidity)    : null).filter((v): v is number => v !== null);
    const avgTemperature = temps.length > 0 ? Math.round((temps.reduce((s, v) => s + v, 0) / temps.length) * 10) / 10 : null;
    const avgHumidity   = hums.length  > 0 ? Math.round((hums.reduce((s, v)  => s + v, 0) / hums.length)  * 10) / 10 : null;

    details.push({ id: dc.id, name: dc.name, rounds: inspections.length, abnormalCount, avgTemperature, avgHumidity });
  }
  return details;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatMinutes(min: number): string {
  if (min <= 0) return "—";
  if (min < 60) return `${min} นาที`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
}

export function complianceColor(pct: number): string {
  if (pct >= 90) return "#059669";
  if (pct >= 70) return "#2563eb";
  if (pct >= 40) return "#d97706";
  return "#dc2626";
}
