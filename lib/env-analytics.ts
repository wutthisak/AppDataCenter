import { prisma } from "@/lib/prisma";

export interface EnvFilter {
  dataCenterId: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  shift?: string;
  inspector?: string;
}

// ─── Executive Summary ────────────────────────────────────────────────────────
export interface EnvSummary {
  inspectionCount: number;   // unique rounds
  checklistCount: number;    // total InspectionResult rows
  normalCount: number;
  abnormalCount: number;
  compliancePct: number;     // normal / total * 100
  avgTemp: number | null;
  avgHumidity: number | null;
  totalDurationMin: number;
}

export async function getEnvSummary(f: EnvFilter): Promise<EnvSummary> {
  const where = buildWhere(f);
  const inspections = await prisma.dailyInspection.findMany({
    where,
    include: { results: true }
  });

  const allResults = inspections.flatMap((i) => i.results);
  const abnormal = allResults.filter((r) => r.status === "ABNORMAL").length;
  const total = allResults.length;

  const temps = allResults.map((r) => r.temperature ? Number(r.temperature) : null).filter((v): v is number => v !== null);
  const hums  = allResults.map((r) => r.humidity   ? Number(r.humidity)    : null).filter((v): v is number => v !== null);

  const totalDurationMin = inspections.reduce((s, i) => {
    if (i.inspectionStartedAt && i.inspectionCompletedAt) {
      return s + Math.round((i.inspectionCompletedAt.getTime() - i.inspectionStartedAt.getTime()) / 60000);
    }
    return s;
  }, 0);

  return {
    inspectionCount: inspections.length,
    checklistCount: total,
    normalCount: total - abnormal,
    abnormalCount: abnormal,
    compliancePct: total > 0 ? Math.round(((total - abnormal) / total) * 100) : 0,
    avgTemp: temps.length > 0 ? Math.round((temps.reduce((s, v) => s + v, 0) / temps.length) * 10) / 10 : null,
    avgHumidity: hums.length > 0 ? Math.round((hums.reduce((s, v) => s + v, 0) / hums.length) * 10) / 10 : null,
    totalDurationMin,
  };
}

// ─── Trend (by day) ───────────────────────────────────────────────────────────
export interface TrendPoint {
  dateLabel: string;  // DD/MM
  isoDate: string;    // YYYY-MM-DD
  avgTemp: number | null;
  avgHumidity: number | null;
  abnormalCount: number;
  inspectionCount: number;
}

export async function getEnvTrend(f: EnvFilter): Promise<TrendPoint[]> {
  const where = buildWhere(f);
  const inspections = await prisma.dailyInspection.findMany({
    where,
    orderBy: { inspectionDate: "asc" },
    include: { results: true }
  });

  const dayMap = new Map<string, { temps: number[]; hums: number[]; abnormal: number; count: number }>();

  for (const insp of inspections) {
    const iso = insp.inspectionDate.toISOString().slice(0, 10);
    if (!dayMap.has(iso)) dayMap.set(iso, { temps: [], hums: [], abnormal: 0, count: 0 });
    const d = dayMap.get(iso)!;
    d.count++;
    for (const r of insp.results) {
      if (r.temperature) d.temps.push(Number(r.temperature));
      if (r.humidity)    d.hums.push(Number(r.humidity));
      if (r.status === "ABNORMAL") d.abnormal++;
    }
  }

  return Array.from(dayMap.entries()).map(([iso, d]) => {
    const [y, m, day] = iso.split("-");
    return {
      dateLabel: `${day}/${m}`,
      isoDate: iso,
      avgTemp: d.temps.length > 0 ? Math.round((d.temps.reduce((s, v) => s + v, 0) / d.temps.length) * 10) / 10 : null,
      avgHumidity: d.hums.length > 0 ? Math.round((d.hums.reduce((s, v) => s + v, 0) / d.hums.length) * 10) / 10 : null,
      abnormalCount: d.abnormal,
      inspectionCount: d.count,
    };
  });
}

// ─── Heatmap (day × shift) ────────────────────────────────────────────────────
export interface HeatmapCell {
  dateLabel: string;
  isoDate: string;
  shift: string;
  inspectionCount: number;
  abnormalCount: number;
  status: "none" | "normal" | "warning" | "critical";
}

export async function getEnvHeatmap(f: EnvFilter): Promise<HeatmapCell[]> {
  const where = buildWhere(f);
  const inspections = await prisma.dailyInspection.findMany({
    where,
    orderBy: { inspectionDate: "asc" },
    include: { results: { select: { status: true } } }
  });

  const SHIFTS = ["OFFICE_HOURS", "MORNING_SHIFT", "AFTERNOON_SHIFT", "NIGHT_SHIFT"];

  // Enumerate all (date × shift) combinations in range — use UTC parts to avoid TZ off-by-one
  const [sy, sm, sd] = f.startDate.split("-").map(Number);
  const [ey, em, ed] = f.endDate.split("-").map(Number);
  const cells: HeatmapCell[] = [];

  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const endD = new Date(Date.UTC(ey, em - 1, ed));

  for (; cur <= endD; cur.setUTCDate(cur.getUTCDate() + 1)) {
    const y2  = cur.getUTCFullYear();
    const m2  = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cur.getUTCDate()).padStart(2, "0");
    const iso = `${y2}-${m2}-${day}`;
    for (const shift of SHIFTS) {
      const matching = inspections.filter(
        (i) => i.inspectionDate.toISOString().slice(0, 10) === iso && i.inspectionShift === shift
      );
      const abnormal = matching.reduce((s, i) => s + i.results.filter((r) => r.status === "ABNORMAL").length, 0);
      const total    = matching.reduce((s, i) => s + i.results.length, 0);
      const count = matching.length;
      let status: HeatmapCell["status"] = "none";
      if (count > 0) {
        const pct = total > 0 ? abnormal / total : 0;
        status = pct === 0 ? "normal" : pct < 0.2 ? "warning" : "critical";
      }
      cells.push({ dateLabel: `${day}/${m2}`, isoDate: iso, shift, inspectionCount: count, abnormalCount: abnormal, status });
    }
  }
  return cells;
}

// ─── Checklist Analytics (per item) ──────────────────────────────────────────
export interface ChecklistItemStat {
  itemId: string;
  itemName: string;
  categoryName: string;
  total: number;
  normal: number;
  abnormal: number;
  passPct: number;
}

export async function getChecklistAnalytics(f: EnvFilter): Promise<ChecklistItemStat[]> {
  const where = buildWhere(f);
  const results = await prisma.inspectionResult.findMany({
    where: { dailyInspection: where },
    include: {
      checklistItem: { include: { category: { select: { name: true } } } }
    }
  });

  const map = new Map<string, ChecklistItemStat>();
  for (const r of results) {
    const key = r.checklistItemId;
    if (!map.has(key)) {
      map.set(key, {
        itemId: key,
        itemName: r.checklistItem.name,
        categoryName: r.checklistItem.category.name,
        total: 0, normal: 0, abnormal: 0, passPct: 0
      });
    }
    const s = map.get(key)!;
    s.total++;
    if (r.status === "NORMAL") s.normal++; else s.abnormal++;
  }

  return Array.from(map.values())
    .map((s) => ({ ...s, passPct: s.total > 0 ? Math.round((s.normal / s.total) * 100) : 0 }))
    .sort((a, b) => a.passPct - b.passPct);
}

// ─── Top Incidents ────────────────────────────────────────────────────────────
export interface TopIncident {
  itemName: string;
  categoryName: string;
  count: number;
  lastDate: string;
  lastNote: string | null;
}

export async function getTopIncidents(f: EnvFilter, limit = 10): Promise<TopIncident[]> {
  const where = buildWhere(f);
  const results = await prisma.inspectionResult.findMany({
    where: { status: "ABNORMAL", dailyInspection: where },
    orderBy: { createdAt: "desc" },
    include: {
      checklistItem: { include: { category: { select: { name: true } } } },
      dailyInspection: { select: { inspectionDate: true } }
    }
  });

  const map = new Map<string, TopIncident & { dates: Date[] }>();
  for (const r of results) {
    const key = r.checklistItemId;
    if (!map.has(key)) {
      map.set(key, {
        itemName: r.checklistItem.name,
        categoryName: r.checklistItem.category.name,
        count: 0, lastDate: "", lastNote: null, dates: []
      });
    }
    const s = map.get(key)!;
    s.count++;
    s.dates.push(r.dailyInspection.inspectionDate);
    if (!s.lastNote && r.note) s.lastNote = r.note;
  }

  return Array.from(map.values())
    .map((s) => {
      const latest = s.dates.sort((a, b) => b.getTime() - a.getTime())[0];
      const iso = latest.toISOString().slice(0, 10);
      const [y, m, d] = iso.split("-");
      return { itemName: s.itemName, categoryName: s.categoryName, count: s.count, lastDate: `${d}/${m}/${y}`, lastNote: s.lastNote };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
export interface TimelineEntry {
  id: string;
  dateLabel: string;
  timeLabel: string;
  shift: string;
  inspector: string;
  total: number;
  abnormal: number;
  status: "normal" | "warning" | "critical";
}

export async function getTimeline(f: EnvFilter, limit = 30): Promise<TimelineEntry[]> {
  const where = buildWhere(f);
  const inspections = await prisma.dailyInspection.findMany({
    where,
    orderBy: { inspectionDate: "desc" },
    take: limit,
    include: { results: { select: { status: true } } }
  });

  const SHIFT_LABELS: Record<string, string> = {
    OFFICE_HOURS: "ทำการ", MORNING_SHIFT: "เช้า", AFTERNOON_SHIFT: "บ่าย", NIGHT_SHIFT: "ดึก"
  };

  return inspections.map((i) => {
    const iso = i.inspectionDate.toISOString().slice(0, 10);
    const [y, m, d] = iso.split("-");
    const abnormal = i.results.filter((r) => r.status === "ABNORMAL").length;
    const total = i.results.length;
    const pct = total > 0 ? abnormal / total : 0;
    return {
      id: i.id,
      dateLabel: `${d}/${m}/${Number(y) + 543}`,
      timeLabel: i.inspectionStartedAt ? i.inspectionStartedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "—",
      shift: SHIFT_LABELS[i.inspectionShift] ?? i.inspectionShift,
      inspector: i.inspectorName,
      total,
      abnormal,
      status: pct === 0 ? "normal" : pct < 0.2 ? "warning" : "critical"
    };
  });
}

// ─── Calendar ────────────────────────────────────────────────────────────────
export interface CalendarDay {
  isoDate: string;
  day: number;
  status: "none" | "normal" | "warning" | "critical";
  inspectionCount: number;
  abnormalCount: number;
}

export async function getCalendar(f: EnvFilter): Promise<CalendarDay[]> {
  const where = buildWhere(f);
  const inspections = await prisma.dailyInspection.findMany({
    where,
    include: { results: { select: { status: true } } }
  });

  const dayMap = new Map<string, { count: number; abnormal: number }>();
  for (const i of inspections) {
    const iso = i.inspectionDate.toISOString().slice(0, 10);
    if (!dayMap.has(iso)) dayMap.set(iso, { count: 0, abnormal: 0 });
    const d = dayMap.get(iso)!;
    d.count++;
    d.abnormal += i.results.filter((r) => r.status === "ABNORMAL").length;
  }

  // Fill all days in range
  const start = new Date(f.startDate);
  const end   = new Date(f.endDate);
  const result: CalendarDay[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const data = dayMap.get(iso);
    let status: CalendarDay["status"] = "none";
    if (data) {
      const pct = data.abnormal > 0 ? data.abnormal / (data.count * 5) : 0; // rough
      status = pct === 0 ? "normal" : pct < 0.2 ? "warning" : "critical";
    }
    result.push({ isoDate: iso, day: d.getDate(), status, inspectionCount: data?.count ?? 0, abnormalCount: data?.abnormal ?? 0 });
  }
  return result;
}

// ─── DC Comparison ────────────────────────────────────────────────────────────
export interface DcStat {
  dcId: string;
  dcName: string;
  inspectionCount: number;
  abnormalCount: number;
  avgTemp: number | null;
  avgHumidity: number | null;
}

export async function getDcComparison(f: Omit<EnvFilter, "dataCenterId">): Promise<DcStat[]> {
  const dataCenters = await prisma.dataCenter.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } });

  return Promise.all(dataCenters.map(async (dc) => {
    const inspections = await prisma.dailyInspection.findMany({
      where: buildWhere({ ...f, dataCenterId: dc.id }),
      include: { results: { select: { status: true, temperature: true, humidity: true } } }
    });
    const allResults = inspections.flatMap((i) => i.results);
    const abnormal = allResults.filter((r) => r.status === "ABNORMAL").length;
    const temps = allResults.map((r) => r.temperature ? Number(r.temperature) : null).filter((v): v is number => v !== null);
    const hums  = allResults.map((r) => r.humidity    ? Number(r.humidity)    : null).filter((v): v is number => v !== null);
    return {
      dcId: dc.id,
      dcName: dc.name,
      inspectionCount: inspections.length,
      abnormalCount: abnormal,
      avgTemp: temps.length > 0 ? Math.round((temps.reduce((s, v) => s + v, 0) / temps.length) * 10) / 10 : null,
      avgHumidity: hums.length > 0 ? Math.round((hums.reduce((s, v) => s + v, 0) / hums.length) * 10) / 10 : null,
    };
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildWhere(f: EnvFilter) {
  const where: Record<string, unknown> = {
    dataCenterId: f.dataCenterId,
    inspectionDate: { gte: new Date(f.startDate), lte: new Date(f.endDate) }
  };
  if (f.shift && f.shift !== "ALL") where.inspectionShift = f.shift;
  if (f.inspector && f.inspector !== "ALL") where.inspectorName = f.inspector;
  return where;
}

// ─── Filter options ───────────────────────────────────────────────────────────
export async function getInspectors(dataCenterId: string): Promise<string[]> {
  const rows = await prisma.dailyInspection.findMany({
    where: { dataCenterId },
    select: { inspectorName: true },
    distinct: ["inspectorName"],
    orderBy: { inspectorName: "asc" }
  });
  return rows.map((r) => r.inspectorName);
}
