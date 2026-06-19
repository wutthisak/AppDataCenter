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

async function getWorkloadMinutes(): Promise<Record<string, number>> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: ["workload_min_vm", "workload_min_server", "workload_min_network"] } }
  });
  const map: Record<string, number> = { VM: 5, SERVER: 5, NETWORK: 5 };
  for (const r of rows) {
    const n = Number(r.value);
    if (!Number.isNaN(n) && n >= 0) {
      if (r.key === "workload_min_vm") map.VM = n;
      if (r.key === "workload_min_server") map.SERVER = n;
      if (r.key === "workload_min_network") map.NETWORK = n;
    }
  }
  return map;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} นาที`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
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
  const [checklistRows, statusEntries, minMap] = await Promise.all([
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
        asset: { select: { category: { select: { code: true } } } }
      }
    }),
    getWorkloadMinutes()
  ]);

  const result: { name: string; value: number }[] = checklistRows.map((r) => ({
    name: r.categoryName,
    value: r._sum.estimatedDurationMin ?? 0
  }));

  const statusByCat: Record<string, number> = {};
  for (const e of statusEntries) {
    const code = e.asset.category.code;
    statusByCat[code] = (statusByCat[code] ?? 0) + (minMap[code] ?? 5);
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

// ─── DailyStatusEntry Workload helpers ──────────────────────────────────────

export async function getStatusEntryWorkloadByUser(since: Date, until?: Date) {
  const [rows, minMap] = await Promise.all([
    prisma.dailyStatusEntry.findMany({
      where: {
        updatedById: { not: null },
        updatedAt: until ? { gte: since, lte: until } : { gte: since },
        asset: { category: { code: { in: ["VM", "SERVER", "NETWORK"] } } }
      },
      select: {
        updatedById: true,
        updatedBy: { select: { displayName: true } },
        asset: { select: { category: { select: { code: true } } } }
      }
    }),
    getWorkloadMinutes()
  ]);

  const byUser: Record<string, { name: string; count: number; totalMin: number }> = {};
  for (const r of rows) {
    const uid = r.updatedById!;
    const name = r.updatedBy?.displayName ?? uid;
    const code = r.asset.category.code;
    const min = minMap[code] ?? 5;
    if (!byUser[uid]) byUser[uid] = { name, count: 0, totalMin: 0 };
    byUser[uid].count++;
    byUser[uid].totalMin += min;
  }

  return Object.values(byUser).map((u) => ({
    name: u.name,
    activityCount: u.count,
    totalMin: u.totalMin
  }));
}

export async function getTodayStatusEntryWorkloadByUser() {
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayBuddhistYear = today.getFullYear() + 543;

  const [rows, minMap] = await Promise.all([
    prisma.dailyStatusEntry.findMany({
      where: {
        updatedById: { not: null },
        day: todayDay,
        report: { month: todayMonth, buddhistYear: todayBuddhistYear },
        asset: { category: { code: { in: ["VM", "SERVER", "NETWORK"] } } }
      },
      select: {
        updatedById: true,
        updatedBy: { select: { displayName: true } },
        asset: { select: { category: { select: { code: true } } } }
      }
    }),
    getWorkloadMinutes()
  ]);

  const byUser: Record<string, { name: string; totalMin: number }> = {};
  for (const r of rows) {
    const uid = r.updatedById!;
    const name = r.updatedBy?.displayName ?? uid;
    const code = r.asset.category.code;
    const min = minMap[code] ?? 5;
    if (!byUser[uid]) byUser[uid] = { name, totalMin: 0 };
    byUser[uid].totalMin += min;
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
