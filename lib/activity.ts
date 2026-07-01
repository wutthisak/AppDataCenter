import { prisma } from "@/lib/prisma";

export const STANDARD_DAILY_CAPACITY_MIN = 420;
export const STATUS_ENTRY_MIN_PER_DEVICE = 5;
export const STATUS_ENTRY_CATEGORY = "ตรวจสอบสถานะระบบ";
export const STATUS_ENTRY_ACTIVITY = "ตรวจสอบ Host Server";

const STATUS_ENTRY_CATEGORY_LABELS: Record<string, string> = {
  VM: "ตรวจสอบ VM Host",
  SERVER: "ตรวจสอบ Host Server",
  NETWORK: "ตรวจสอบ Network Device"
};

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} นาที`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
}

// ─── New Inspection KPI helpers (uses real durationMinutes) ─────────────────

export const SHIFT_LABELS: Record<string, string> = {
  MORNING_SHIFT: "เวรเช้า (08:00–16:00)",
  AFTERNOON_SHIFT: "เวรบ่าย (16:00–24:00)",
  NIGHT_SHIFT: "เวรดึก (00:00–08:00)",
  OFFICE_HOURS: "เวลาทำการ"
};

export const CATEGORY_LABELS: Record<string, string> = {
  VM: "ตรวจสอบ VM Host",
  SERVER: "ตรวจสอบ Host Server",
  NETWORK: "ตรวจสอบ Network Device",
  BACKUP: "ตรวจสอบ Database",
};

export const CATEGORY_COLORS: Record<string, string> = {
  VM: "#2563eb",
  SERVER: "#0891b2",
  NETWORK: "#7c3aed",
  STORAGE: "#0f766e",
  BACKUP: "#d97706",
};

// Valid AssetCategoryCode values from Prisma schema enum
const VALID_CATEGORY_CODES = new Set(["VM", "SERVER", "NETWORK", "STORAGE", "BACKUP"]);

// Group entries into inspection rounds: same user + reportId + day + shift + slot + duration = 1 round
function groupIntoRounds<T extends {
  updatedById?: string | null;
  reportId?: string;
  day?: number;
  inspectionShift?: string;
  timeSlot?: string;
  durationMinutes?: number | null;
}>(entries: T[]): { key: string; duration: number; rows: T[] }[] {
  const map = new Map<string, { duration: number; rows: T[] }>();
  for (const e of entries) {
    const key = [
      e.updatedById ?? "_",
      e.reportId ?? "_",
      e.day ?? 0,
      e.inspectionShift ?? "_",
      e.timeSlot ?? "_",
      e.durationMinutes ?? 0
    ].join("|");
    if (!map.has(key)) map.set(key, { duration: e.durationMinutes ?? 0, rows: [] });
    map.get(key)!.rows.push(e);
  }
  return Array.from(map.entries()).map(([key, v]) => ({ key, duration: v.duration, rows: v.rows }));
}

export async function getInspectionKpi(since: Date, until?: Date) {
  const dateFilter = until ? { gte: since, lte: until } : { gte: since };
  const entries = await prisma.dailyStatusEntry.findMany({
    where: { updatedAt: dateFilter },
    select: {
      id: true,
      reportId: true,
      day: true,
      statusCode: true,
      durationMinutes: true,
      inspectionStartedAt: true,
      inspectionCompletedAt: true,
      inspectionShift: true,
      timeSlot: true,
      updatedAt: true,
      updatedById: true,
      asset: { select: { category: { select: { code: true, name: true } } } }
    }
  });

  const roundCount = entries.length;
  const normalCount = entries.filter((e) => e.statusCode === "N").length;
  const abnormalCount = roundCount - normalCount;

  // Sum unique rounds only (group by user+report+day+shift+slot+duration)
  const rounds = groupIntoRounds(entries);
  const totalMinutes = rounds.reduce((s, r) => s + r.duration, 0);
  const avgMinutes = roundCount > 0 ? Math.round(totalMinutes / roundCount) : 0;

  return { roundCount, totalMinutes, avgMinutes, normalCount, abnormalCount };
}

export async function getInspectionRounds(since: Date, until?: Date, options?: {
  categoryCode?: string;
  shift?: string;
  statusFilter?: "all" | "normal" | "abnormal";
  limit?: number;
}) {
  const dateFilter = until ? { gte: since, lte: until } : { gte: since };
  const where: Record<string, unknown> = { updatedAt: dateFilter };
  if (options?.categoryCode && VALID_CATEGORY_CODES.has(options.categoryCode)) {
    where.asset = { category: { code: options.categoryCode } };
  }
  if (options?.shift && options.shift !== "ALL") {
    where.inspectionShift = options.shift;
  }
  if (options?.statusFilter === "normal") {
    where.statusCode = "N";
  } else if (options?.statusFilter === "abnormal") {
    where.NOT = { statusCode: "N" };
  }

  return prisma.dailyStatusEntry.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: options?.limit ?? 50,
    select: {
      id: true,
      day: true,
      timeSlot: true,
      inspectionShift: true,
      durationMinutes: true,
      inspectionStartedAt: true,
      inspectionCompletedAt: true,
      inspectedAt: true,
      statusCode: true,
      note: true,
      updatedAt: true,
      asset: { select: { name: true, category: { select: { code: true, name: true } } } },
      updatedBy: { select: { displayName: true } },
      report: { select: { month: true, buddhistYear: true } }
    }
  });
}

export async function getInspectionKpiByCategory(since: Date, until?: Date) {
  const dateFilter = until ? { gte: since, lte: until } : { gte: since };
  const entries = await prisma.dailyStatusEntry.findMany({
    where: { updatedAt: dateFilter },
    select: {
      reportId: true,
      day: true,
      statusCode: true,
      durationMinutes: true,
      inspectionShift: true,
      timeSlot: true,
      updatedById: true,
      asset: { select: { category: { select: { code: true, name: true } } } }
    }
  });

  const byCat: Record<string, { name: string; roundCount: number; totalMinutes: number; normalCount: number }> = {};

  // Group by category first, then deduplicate rounds within each category
  const byCatRows: Record<string, typeof entries> = {};
  for (const e of entries) {
    const code = e.asset.category.code;
    if (!byCatRows[code]) byCatRows[code] = [];
    byCatRows[code].push(e);
  }
  for (const [code, rows] of Object.entries(byCatRows)) {
    const name = CATEGORY_LABELS[code] ?? rows[0].asset.category.name;
    const rounds = groupIntoRounds(rows);
    byCat[code] = {
      name,
      roundCount: rows.length,
      totalMinutes: rounds.reduce((s, r) => s + r.duration, 0),
      normalCount: rows.filter((e) => e.statusCode === "N").length
    };
  }

  return Object.entries(byCat).map(([code, v]) => ({
    code,
    name: v.name,
    roundCount: v.roundCount,
    totalMinutes: v.totalMinutes,
    avgMinutes: v.roundCount > 0 ? Math.round(v.totalMinutes / v.roundCount) : 0,
    normalCount: v.normalCount,
    abnormalCount: v.roundCount - v.normalCount,
    pct: 0
  })).sort((a, b) => b.totalMinutes - a.totalMinutes).map((item, _i, arr) => {
    const total = arr.reduce((s, x) => s + x.totalMinutes, 0);
    return { ...item, pct: total > 0 ? Math.round((item.totalMinutes / total) * 100) : 0 };
  });
}

// ─── Checklist / ActivityLog helpers ────────────────────────────────────────

export async function getTodayActivityStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const where = { inspectionDate: { gte: todayStart, lte: todayEnd } };

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayBuddhistYear = today.getFullYear() + 543;

  const [activityCount, durationAgg, inspectionCount, inspectors, statusWorkload, statusEntryCount] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.aggregate({ where, _sum: { estimatedDurationMin: true } }),
    prisma.dailyInspection.count({
      where: { inspectionDate: { gte: todayStart, lte: todayEnd } }
    }),
    prisma.activityLog.findMany({
      where,
      select: { inspectorName: true },
      distinct: ["inspectorName"]
    }),
    getTodayStatusEntryWorkloadByUser(),
    prisma.dailyStatusEntry.count({
      where: {
        day: todayDay,
        report: { month: todayMonth, buddhistYear: todayBuddhistYear },
        asset: { category: { code: { in: ["VM", "SERVER", "NETWORK"] } } }
      }
    })
  ]);

  const checklistMin = durationAgg._sum.estimatedDurationMin ?? 0;
  const statusMin = statusWorkload.reduce((s, r) => s + r.totalMin, 0);

  return {
    activityCount: activityCount + statusEntryCount,
    totalDurationMin: checklistMin + statusMin,
    inspectionCount,
    activeUserCount: inspectors.length,
    inspectors: inspectors.map((i) => i.inspectorName)
  };
}

export async function getTopActivities(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.activityLog.groupBy({
    by: ["title", "categoryName"],
    where: { inspectionDate: { gte: since } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5
  });

  return rows.map((r) => ({
    title: r.title,
    categoryName: r.categoryName,
    count: r._count.id
  }));
}

export async function getWorkloadByCategory(since: Date, until?: Date) {
  const dateFilter = until
    ? { gte: since, lte: until }
    : { gte: since };
  const [checklistRows, statusEntries] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ["categoryName"],
      where: { inspectionDate: dateFilter },
      _sum: { estimatedDurationMin: true },
      orderBy: { _sum: { estimatedDurationMin: "desc" } }
    }),
    prisma.dailyStatusEntry.findMany({
      where: {
        updatedAt: until ? { gte: since, lte: until } : { gte: since },
        asset: { category: { code: { in: ["VM", "SERVER", "NETWORK"] } } }
      },
      select: {
        durationMinutes: true,
        asset: { select: { category: { select: { code: true } } } }
      }
    })
  ]);

  const result: { name: string; value: number }[] = checklistRows.map((r) => ({
    name: r.categoryName,
    value: r._sum.estimatedDurationMin ?? 0
  }));

  const statusByCat: Record<string, number> = {};
  for (const e of statusEntries) {
    const code = e.asset.category.code;
    statusByCat[code] = (statusByCat[code] ?? 0) + (e.durationMinutes ?? 0);
  }
  for (const [code, totalMin] of Object.entries(statusByCat)) {
    if (totalMin > 0) {
      result.push({ name: STATUS_ENTRY_CATEGORY_LABELS[code] ?? code, value: totalMin });
    }
  }

  const total = result.reduce((s, r) => s + r.value, 0);
  return result
    .map((r) => ({
      name: r.name,
      value: r.value,
      pct: total > 0 ? Math.round((r.value / total) * 100) : 0
    }))
    .sort((a, b) => b.value - a.value);
}

export async function getWorkloadByUser(since: Date, until?: Date) {
  const dateFilter = until
    ? { gte: since, lte: until }
    : { gte: since };
  const [checklistRows, statusRows] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ["inspectorName"],
      where: { inspectionDate: dateFilter },
      _count: { id: true },
      _sum: { estimatedDurationMin: true },
      orderBy: { _sum: { estimatedDurationMin: "desc" } }
    }),
    getStatusEntryWorkloadByUser(since, until)
  ]);

  const merged: Record<string, { activityCount: number; totalMin: number }> = {};
  for (const r of checklistRows) {
    merged[r.inspectorName] = {
      activityCount: r._count.id,
      totalMin: r._sum.estimatedDurationMin ?? 0
    };
  }
  for (const r of statusRows) {
    if (merged[r.name]) {
      merged[r.name].activityCount += r.activityCount;
      merged[r.name].totalMin += r.totalMin;
    } else {
      merged[r.name] = { activityCount: r.activityCount, totalMin: r.totalMin };
    }
  }

  return Object.entries(merged)
    .map(([name, v]) => ({ name, activityCount: v.activityCount, totalMin: v.totalMin }))
    .sort((a, b) => b.totalMin - a.totalMin);
}

// ─── Workload Dashboard (dynamic capacity from active users) ────────────────

// Duration of each inspectionShift in minutes (used as max capacity bound when shift is filtered)
const SHIFT_DURATION_MIN: Record<string, number> = {
  MORNING_SHIFT: 480,    // 08:00–16:00
  AFTERNOON_SHIFT: 480,  // 16:00–24:00
  NIGHT_SHIFT: 480,      // 00:00–08:00
  OFFICE_HOURS: 540,     // 08:00–17:00
};
// Every timeSlot covers exactly 1 hour
const SLOT_DURATION_MIN = 60;

export interface WorkloadUserRow {
  id: string;
  name: string;
  shifts: string[];         // distinct shifts the user inspected
  slotCount: number;        // distinct timeSlots inspected (capacity basis)
  capacityMin: number;      // slotCount × 60 min
  roundCount: number;       // unique inspection rounds (deduplicated)
  itemCount: number;        // total entry rows
  totalMin: number;         // sum of unique round durations
  avgPerRound: number;      // totalMin / roundCount
  avgPerItem: number;       // totalMin / itemCount (decimal 1 place)
  workloadPct: number;      // Personal Workload: totalMin / capacityMin × 100
  distributionPct: number;  // Team Distribution: totalMin / teamTotalMin × 100
}

export interface WorkloadDashboard {
  activeUserCount: number;
  teamCapacityMin: number;
  teamTotalMin: number;
  teamRoundCount: number;
  teamItemCount: number;
  teamAvgRoundMin: number;
  teamAvgItemMin: number;
  teamWorkloadPct: number;  // avg Personal Workload across users with data
  idleMin: number;
  users: WorkloadUserRow[];
}

export async function getWorkloadDashboard(
  since: Date,
  until?: Date,
  options?: { categoryCode?: string; shift?: string; statusFilter?: "all" | "normal" | "abnormal" }
): Promise<WorkloadDashboard> {
  // 1. Active users
  const activeUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, displayName: true }
  });
  const activeUserCount = activeUsers.length;
  const activeUserMap = new Map(activeUsers.map((u) => [u.id, u.displayName]));

  // 2. Fetch all entries in range with round-grouping fields
  const where: Record<string, unknown> = {
    updatedById: { not: null },
    updatedAt: until ? { gte: since, lte: until } : { gte: since },
  };
  const catCode = options?.categoryCode;
  if (catCode && catCode !== "ALL" && VALID_CATEGORY_CODES.has(catCode)) {
    where.asset = { category: { code: catCode } };
  }
  if (options?.shift && options.shift !== "ALL") {
    where.inspectionShift = options.shift;
  }
  if (options?.statusFilter === "normal") where.statusCode = "N";
  else if (options?.statusFilter === "abnormal") where.NOT = { statusCode: "N" };

  // If invalid category code passed (e.g. DATABASE), return empty dashboard
  if (catCode && catCode !== "ALL" && !VALID_CATEGORY_CODES.has(catCode)) {
    return {
      activeUserCount, teamCapacityMin: 0, teamTotalMin: 0,
      teamRoundCount: 0, teamItemCount: 0, teamAvgRoundMin: 0, teamAvgItemMin: 0,
      teamWorkloadPct: 0, idleMin: 0, users: []
    };
  }

  const rows = await (prisma.dailyStatusEntry as any).findMany({
    where,
    select: {
      reportId: true,
      day: true,
      updatedById: true,
      durationMinutes: true,
      inspectionShift: true,
      timeSlot: true,
    }
  }) as Array<{
    reportId: string; day: number; updatedById: string | null;
    durationMinutes: number | null; inspectionShift: string; timeSlot: string;
  }>;

  // 3. Group by user, then compute per-user metrics
  const byUser: Record<string, { rows: typeof rows }> = {};
  // Pre-populate active users so users with 0 entries still appear
  for (const [uid] of activeUserMap) {
    byUser[uid] = { rows: [] };
  }
  for (const r of rows) {
    const uid = r.updatedById!;
    if (!byUser[uid]) byUser[uid] = { rows: [] };
    byUser[uid].rows.push(r);
  }

  const userRows: WorkloadUserRow[] = [];
  let teamTotalMin = 0;
  let teamCapacityMin = 0;

  for (const [uid, data] of Object.entries(byUser)) {
    const name = activeUserMap.get(uid) ?? uid;
    const itemCount = data.rows.length;
    const rounds = groupIntoRounds(data.rows);
    const roundCount = rounds.length;
    const totalMin = rounds.reduce((s, r) => s + r.duration, 0);
    teamTotalMin += totalMin;

    // Capacity = unique (shift+day+slot) combinations the user was active in × 60 min
    // If shift is globally filtered to 1 shift, capacity is bounded by that shift's duration
    const uniqueSlots = new Set(
      data.rows.map((r) => `${r.inspectionShift}|${r.reportId}|${r.day}|${r.timeSlot}`)
    );
    const uniqueShifts = [...new Set(data.rows.map((r) => r.inspectionShift))];

    let capacityMin: number;
    if (options?.shift && options.shift !== "ALL") {
      // When filtered to a single shift, cap capacity at the shift duration × days spanned
      const shiftDur = SHIFT_DURATION_MIN[options.shift] ?? 480;
      // Count unique days the user worked in this shift
      const uniqueDays = new Set(data.rows.map((r) => `${r.reportId}|${r.day}`));
      capacityMin = uniqueDays.size > 0
        ? uniqueDays.size * shiftDur
        : uniqueSlots.size * SLOT_DURATION_MIN;
    } else {
      // No shift filter: capacity = unique slots × 60 min
      capacityMin = uniqueSlots.size * SLOT_DURATION_MIN;
    }

    // Users with no entries: capacity = 0, shown in table as 0/0%
    if (itemCount === 0) capacityMin = 0;
    teamCapacityMin += capacityMin;

    const avgPerRound = roundCount > 0 ? Math.round(totalMin / roundCount) : 0;
    const avgPerItem = itemCount > 0 ? Math.round((totalMin / itemCount) * 10) / 10 : 0;
    const workloadPct = capacityMin > 0 ? Math.round((totalMin / capacityMin) * 100) : 0;

    userRows.push({
      id: uid, name,
      shifts: uniqueShifts,
      slotCount: uniqueSlots.size,
      capacityMin,
      roundCount, itemCount, totalMin,
      avgPerRound, avgPerItem, workloadPct,
      distributionPct: 0   // filled in second pass below
    });
  }

  // Second pass: compute Team Distribution % now that teamTotalMin is known
  for (const u of userRows) {
    u.distributionPct = teamTotalMin > 0
      ? Math.round((u.totalMin / teamTotalMin) * 1000) / 10   // 1 decimal
      : 0;
  }

  userRows.sort((a, b) => b.totalMin - a.totalMin);

  // Team aggregates
  const teamRoundCount = userRows.reduce((s, u) => s + u.roundCount, 0);
  const teamItemCount  = userRows.reduce((s, u) => s + u.itemCount, 0);
  const teamAvgRoundMin = teamRoundCount > 0 ? Math.round(teamTotalMin / teamRoundCount) : 0;
  const teamAvgItemMin  = teamItemCount  > 0 ? Math.round((teamTotalMin / teamItemCount) * 10) / 10 : 0;

  // teamWorkloadPct = average Personal Workload of users who have capacity
  const usersWithCapacity = userRows.filter((u) => u.capacityMin > 0);
  const teamWorkloadPct = usersWithCapacity.length > 0
    ? Math.round(usersWithCapacity.reduce((s, u) => s + u.workloadPct, 0) / usersWithCapacity.length)
    : 0;

  const idleMin = Math.max(0, teamCapacityMin - teamTotalMin);

  return {
    activeUserCount, teamCapacityMin, teamTotalMin,
    teamRoundCount, teamItemCount, teamAvgRoundMin, teamAvgItemMin,
    teamWorkloadPct, idleMin, users: userRows
  };
}

// ─── DailyStatusEntry Workload helpers (uses real durationMinutes) ───────────

export async function getStatusEntryWorkloadByUser(since: Date, until?: Date) {
  const rows = await prisma.dailyStatusEntry.findMany({
    where: {
      updatedById: { not: null },
      updatedAt: until ? { gte: since, lte: until } : { gte: since },
    },
    select: {
      reportId: true,
      day: true,
      updatedById: true,
      durationMinutes: true,
      inspectionShift: true,
      timeSlot: true,
      updatedBy: { select: { displayName: true } },
    }
  });

  // Group by user first, then deduplicate rounds per user
  const byUser: Record<string, { name: string; rows: typeof rows }> = {};
  for (const r of rows) {
    const uid = r.updatedById!;
    const name = r.updatedBy?.displayName ?? uid;
    if (!byUser[uid]) byUser[uid] = { name, rows: [] };
    byUser[uid].rows.push(r);
  }

  return Object.values(byUser).map((u) => {
    const rounds = groupIntoRounds(u.rows);
    return {
      name: u.name,
      activityCount: u.rows.length,
      totalMin: rounds.reduce((s, r) => s + r.duration, 0)
    };
  }).sort((a, b) => b.totalMin - a.totalMin);
}

export async function getTodayStatusEntryWorkloadByUser() {
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayBuddhistYear = today.getFullYear() + 543;

  const rows = await prisma.dailyStatusEntry.findMany({
    where: {
      updatedById: { not: null },
      day: todayDay,
      report: { month: todayMonth, buddhistYear: todayBuddhistYear },
      asset: { category: { code: { in: ["VM", "SERVER", "NETWORK"] } } }
    },
    select: {
      updatedById: true,
      durationMinutes: true,
      updatedBy: { select: { displayName: true } }
    }
  });

  const byUser: Record<string, { name: string; totalMin: number }> = {};
  for (const r of rows) {
    const uid = r.updatedById!;
    const name = r.updatedBy?.displayName ?? uid;
    if (!byUser[uid]) byUser[uid] = { name, totalMin: 0 };
    byUser[uid].totalMin += r.durationMinutes ?? 0;
  }

  return Object.values(byUser).map((u) => ({
    name: u.name,
    totalMin: u.totalMin
  }));
}

export async function getTodayWorkloadWarnings() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [checklistRows, statusRows] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ["inspectorName"],
      where: { inspectionDate: { gte: todayStart, lte: todayEnd } },
      _sum: { estimatedDurationMin: true }
    }),
    getTodayStatusEntryWorkloadByUser()
  ]);

  const merged: Record<string, number> = {};
  for (const r of checklistRows) {
    merged[r.inspectorName] = (merged[r.inspectorName] ?? 0) + (r._sum.estimatedDurationMin ?? 0);
  }
  for (const r of statusRows) {
    merged[r.name] = (merged[r.name] ?? 0) + r.totalMin;
  }

  return Object.entries(merged)
    .map(([name, totalMin]) => ({
      name,
      totalMin,
      pct: Math.round((totalMin / STANDARD_DAILY_CAPACITY_MIN) * 100)
    }))
    .filter((r) => r.totalMin > STANDARD_DAILY_CAPACITY_MIN)
    .sort((a, b) => b.totalMin - a.totalMin);
}

export async function getActivityTrend(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.activityLog.groupBy({
    by: ["inspectionDate"],
    where: { inspectionDate: { gte: since } },
    _count: { id: true },
    orderBy: { inspectionDate: "asc" }
  });

  return rows.map((r) => ({
    date: new Date(r.inspectionDate).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" }),
    count: r._count.id
  }));
}

export async function getRecentActivities(limit = 10) {
  return prisma.activityLog.findMany({
    where: {},
    orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      categoryName: true,
      inspectorName: true,
      inspectionShift: true,
      inspectionDate: true,
      status: true,
      activityType: true,
      note: true
    }
  });
}

// ─── Daily Status (VM Host / Host Server / Network / Database) ───────────────

export async function getTodayStatusStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [total, abnormal, assets] = await Promise.all([
    prisma.dailyStatusEntry.count({
      where: { updatedAt: { gte: todayStart, lte: todayEnd } }
    }),
    prisma.dailyStatusEntry.count({
      where: {
        updatedAt: { gte: todayStart, lte: todayEnd },
        NOT: { statusCode: "N" }
      }
    }),
    prisma.dailyStatusEntry.findMany({
      where: { updatedAt: { gte: todayStart, lte: todayEnd } },
      select: { assetId: true },
      distinct: ["assetId"]
    })
  ]);

  return {
    entryCount: total,
    abnormalCount: abnormal,
    normalCount: total - abnormal,
    assetCount: assets.length
  };
}

export async function getRecentStatusEntries(limit = 8) {
  return prisma.dailyStatusEntry.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      day: true,
      statusCode: true,
      note: true,
      updatedAt: true,
      asset: { select: { name: true, category: { select: { name: true, code: true } } } },
      report: { select: { month: true, buddhistYear: true } }
    }
  });
}

export async function getStatusTrendLast30Days() {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.dailyStatusEntry.findMany({
    where: { updatedAt: { gte: since } },
    select: { updatedAt: true, statusCode: true }
  });

  const byDate: Record<string, { date: string; normal: number; abnormal: number }> = {};
  for (const row of rows) {
    const d = row.updatedAt.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
    if (!byDate[d]) byDate[d] = { date: d, normal: 0, abnormal: 0 };
    if (row.statusCode === "N") byDate[d].normal++;
    else byDate[d].abnormal++;
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Server Metrics (CPU / RAM / Disk) ───────────────────────────────────────

export async function getTodayMetricStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const metrics = await prisma.serverMetricLog.findMany({
    where: { measuredAt: { gte: todayStart, lte: todayEnd } },
    select: { cpuPercent: true, ramUsedGb: true, ramTotalGb: true, diskUsedGb: true, diskTotalGb: true }
  });

  if (metrics.length === 0) return { count: 0, avgCpu: 0, avgRamPct: 0, avgDiskPct: 0 };

  const count = metrics.length;
  const avgCpu = metrics.reduce((s, m) => s + Number(m.cpuPercent), 0) / count;
  const avgRamPct =
    metrics.reduce((s, m) => s + (Number(m.ramTotalGb) > 0 ? (Number(m.ramUsedGb) / Number(m.ramTotalGb)) * 100 : 0), 0) / count;
  const avgDiskPct =
    metrics.reduce((s, m) => s + (Number(m.diskTotalGb) > 0 ? (Number(m.diskUsedGb) / Number(m.diskTotalGb)) * 100 : 0), 0) / count;

  return {
    count,
    avgCpu: Math.round(avgCpu * 10) / 10,
    avgRamPct: Math.round(avgRamPct * 10) / 10,
    avgDiskPct: Math.round(avgDiskPct * 10) / 10
  };
}

export async function getRecentMetrics(limit = 8) {
  return prisma.serverMetricLog.findMany({
    orderBy: { measuredAt: "desc" },
    take: limit,
    select: {
      id: true,
      measuredAt: true,
      cpuPercent: true,
      ramUsedGb: true,
      ramTotalGb: true,
      diskUsedGb: true,
      diskTotalGb: true,
      note: true,
      serverAsset: { select: { name: true, category: { select: { name: true } } } }
    }
  });
}

export async function getMetricTrend30Days() {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.serverMetricLog.findMany({
    where: { measuredAt: { gte: since } },
    select: { measuredAt: true, cpuPercent: true, ramUsedGb: true, ramTotalGb: true }
  });

  const byDate: Record<string, { date: string; totalCpu: number; totalRamPct: number; count: number }> = {};
  for (const row of rows) {
    const d = row.measuredAt.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
    if (!byDate[d]) byDate[d] = { date: d, totalCpu: 0, totalRamPct: 0, count: 0 };
    byDate[d].totalCpu += Number(row.cpuPercent);
    byDate[d].totalRamPct += Number(row.ramTotalGb) > 0 ? (Number(row.ramUsedGb) / Number(row.ramTotalGb)) * 100 : 0;
    byDate[d].count++;
  }

  return Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      avgCpu: Math.round((d.totalCpu / d.count) * 10) / 10,
      avgRamPct: Math.round((d.totalRamPct / d.count) * 10) / 10
    }));
}

// ─── Monthly helpers ──────────────────────────────────────────────────────────

export async function getMonthlyStats(year: number, month: number) {
  const start = new Date(year - 543, month - 1, 1);
  const end = new Date(year - 543, month, 0, 23, 59, 59, 999);

  const where = { inspectionDate: { gte: start, lte: end } };

  const [activityCount, durationAgg, inspectors, inspectionCount, totalInspectionItems] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.aggregate({ where, _sum: { estimatedDurationMin: true } }),
    prisma.activityLog.findMany({ where, select: { inspectorName: true }, distinct: ["inspectorName"] }),
    prisma.dailyInspection.count({ where: { inspectionDate: { gte: start, lte: end } } }),
    prisma.checklistItem.count({ where: { active: true, category: { active: true } } })
  ]);

  const maxPossible = inspectionCount * totalInspectionItems;
  const completionPct = maxPossible > 0 ? Math.round((activityCount / maxPossible) * 100) : 0;

  return {
    activityCount,
    totalDurationMin: durationAgg._sum.estimatedDurationMin ?? 0,
    activeUserCount: inspectors.length,
    completionPct: Math.min(completionPct, 100)
  };
}

export async function getMonthlyActivityTrend(year: number, month: number) {
  const start = new Date(year - 543, month - 1, 1);
  const end = new Date(year - 543, month, 0, 23, 59, 59, 999);

  const rows = await prisma.activityLog.groupBy({
    by: ["inspectionDate"],
    where: { inspectionDate: { gte: start, lte: end } },
    _count: { id: true },
    orderBy: { inspectionDate: "asc" }
  });

  return rows.map((r) => ({
    date: new Date(r.inspectionDate).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" }),
    count: r._count.id
  }));
}

export async function getTopCategoryForMonth(year: number, month: number) {
  const start = new Date(year - 543, month - 1, 1);
  const end = new Date(year - 543, month, 0, 23, 59, 59, 999);

  const rows = await prisma.activityLog.groupBy({
    by: ["categoryName"],
    where: { inspectionDate: { gte: start, lte: end } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1
  });

  return rows[0]?.categoryName ?? null;
}

export async function getTopActivitiesForMonth(year: number, month: number) {
  const start = new Date(year - 543, month - 1, 1);
  const end = new Date(year - 543, month, 0, 23, 59, 59, 999);

  const rows = await prisma.activityLog.groupBy({
    by: ["title", "categoryName"],
    where: { inspectionDate: { gte: start, lte: end } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5
  });

  return rows.map((r) => ({ title: r.title, categoryName: r.categoryName, count: r._count.id }));
}

export async function getMonthlyStatusStats(year: number, month: number) {
  const start = new Date(year - 543, month - 1, 1);
  const end = new Date(year - 543, month, 0, 23, 59, 59, 999);

  const [total, abnormal] = await Promise.all([
    prisma.dailyStatusEntry.count({ where: { updatedAt: { gte: start, lte: end } } }),
    prisma.dailyStatusEntry.count({
      where: { updatedAt: { gte: start, lte: end }, NOT: { statusCode: "N" } }
    })
  ]);

  return { total, abnormal, normal: total - abnormal };
}

export async function getMonthlyMetricStats(year: number, month: number) {
  const start = new Date(year - 543, month - 1, 1);
  const end = new Date(year - 543, month, 0, 23, 59, 59, 999);

  const metrics = await prisma.serverMetricLog.findMany({
    where: { measuredAt: { gte: start, lte: end } },
    select: { cpuPercent: true, ramUsedGb: true, ramTotalGb: true, diskUsedGb: true, diskTotalGb: true }
  });

  if (metrics.length === 0) return { count: 0, avgCpu: 0, avgRamPct: 0, avgDiskPct: 0 };

  const count = metrics.length;
  const avgCpu = metrics.reduce((s, m) => s + Number(m.cpuPercent), 0) / count;
  const avgRamPct =
    metrics.reduce((s, m) => s + (Number(m.ramTotalGb) > 0 ? (Number(m.ramUsedGb) / Number(m.ramTotalGb)) * 100 : 0), 0) / count;
  const avgDiskPct =
    metrics.reduce((s, m) => s + (Number(m.diskTotalGb) > 0 ? (Number(m.diskUsedGb) / Number(m.diskTotalGb)) * 100 : 0), 0) / count;

  return {
    count,
    avgCpu: Math.round(avgCpu * 10) / 10,
    avgRamPct: Math.round(avgRamPct * 10) / 10,
    avgDiskPct: Math.round(avgDiskPct * 10) / 10
  };
}
