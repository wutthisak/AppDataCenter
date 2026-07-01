"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { AssetCategoryCode, AssetOptionType, Role, InspectionStatus, InspectionShift, InspectionTimeSlot } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canEditRole, canReviewRole, createSession, destroySession, requireUser } from "@/lib/auth";
import { createTotpSecret, verifyTotp } from "@/lib/totp";
import { validateDay, validateStatusCode } from "@/lib/report";
import { generatedBackupJobAssetExclusion, isGeneratedBackupJobAssetCode, parseAssetCapacityGb, parseBuddhistDateInput } from "@/lib/assets";
import { getShiftForTimeSlot, shiftDefaultSlots } from "@/lib/inspection-shifts";

function safeLocalPath(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value ?? "").trim();
  if (!path || !path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

function appendRefreshParam(path: string) {
  try {
    const url = new URL(path, "http://localhost");
    url.searchParams.set("__refresh", Date.now().toString());
    return url.pathname + url.search;
  } catch {
    return path;
  }
}

function appendLocalParam(path: string, key: string, value: string) {
  try {
    const url = new URL(path, "http://localhost");
    url.searchParams.set(key, value);
    return url.pathname + url.search;
  } catch {
    return path;
  }
}

function revalidateLocalPath(path: string) {
  try {
    const url = new URL(path, "http://localhost");
    revalidatePath(url.pathname);
  } catch {
    revalidatePath(path || "/");
  }
}

function parseOptionalDateTime(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalSaveMeta() {
  return { isBackdated: false, backdateReason: null };
}

function defaultTimeSlotForShift(shift: InspectionShift) {
  return (shiftDefaultSlots[shift]?.[0] ?? "SLOT_0800_0900") as InspectionTimeSlot;
}

function parseAssetOptionType(value: FormDataEntryValue | null): AssetOptionType | null {
  const type = String(value ?? "");
  return type === "DATABASE_TYPE" || type === "OS_TYPE" || type === "NETWORK_BRAND" || type === "DEVICE_TYPE" || type === "STORAGE_DEVICE_TYPE" || type === "BUILDING" || type === "ASSET_OWNERSHIP_TYPE" ? type as AssetOptionType : null;
}

function revalidateAssetOptionPaths(returnTo: string) {
  revalidatePath("/admin/settings/basic");
  revalidatePath("/admin/assets/vm");
  revalidatePath("/admin/assets/host");
  revalidatePath("/admin/assets/network");
  revalidatePath("/admin/assets/backup");
  revalidateLocalPath(returnTo);
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const token = String(formData.get("token") ?? "").trim();

  const user = await prisma.user.findFirst({ where: { username, active: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/login?error=invalid");
  }

  if (user.twoFactorEnabled) {
    if (!token || !user.twoFactorSecret || !verifyTotp(token, user.twoFactorSecret)) {
      redirect("/login?error=totp");
    }
  }

  await createSession({ userId: user.id, role: user.role });
  if (user.mustChangePassword) redirect("/profile?forcePassword=1");
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function ensureReportAction(formData: FormData) {
  await requireUser();
  const month = Number(formData.get("month"));
  const buddhistYear = Number(formData.get("buddhistYear"));
  const returnTo = safeLocalPath(formData.get("returnTo"), "");

  const report = await prisma.monthlyReport.upsert({
    where: { month_buddhistYear: { month, buddhistYear } },
    update: {},
    create: { month, buddhistYear }
  });

  let destination = returnTo;
  if (returnTo.startsWith("/reports/daily/")) {
    const url = new URL(returnTo, "http://localhost");
    url.searchParams.set("month", String(month));
    url.searchParams.set("buddhistYear", String(buddhistYear));
    destination = url.pathname + url.search;
  }

  redirect(destination || `/reports/${report.id}`);
}

export async function upsertStatusAction(formData: FormData) {
  const user = await requireUser();
  if (!canEditRole(user.role)) redirect("/");

  const reportId = String(formData.get("reportId"));
  const assetId = String(formData.get("assetId"));
  const day = Number(formData.get("day"));
  const statusCode = String(formData.get("statusCode"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const returnTo = safeLocalPath(formData.get("returnTo"), `/reports/${reportId}`);
  const timeSlotRaw = formData.get("timeSlot");
  const timeSlot = (timeSlotRaw ? parseTimeSlot(timeSlotRaw) : null) ?? ("SLOT_0800_0900" as InspectionTimeSlot);
  const inspectionShift = parseInspectionShift(formData.get("inspectionShift")) ?? getShiftForTimeSlot(timeSlot);
  const inspectedAt = parseOptionalDateTime(formData.get("inspectedAt"));
  const durationMinutesRaw = Number(formData.get("durationMinutes") ?? 0);
  const durationMinutes = Number.isFinite(durationMinutesRaw) && [5, 10, 15, 30, 45, 60].includes(durationMinutesRaw)
    ? durationMinutesRaw : null;
  const SLOT_START: Record<string, string> = {
    SLOT_0800_0900: "08:00", SLOT_0900_1000: "09:00", SLOT_1000_1100: "10:00", SLOT_1100_1200: "11:00",
    SLOT_1200_1300: "12:00", SLOT_1300_1400: "13:00", SLOT_1400_1500: "14:00", SLOT_1500_1600: "15:00",
    SLOT_1600_1700: "16:00", SLOT_1700_1800: "17:00", SLOT_1800_1900: "18:00", SLOT_1900_2000: "19:00",
    SLOT_2000_2100: "20:00", SLOT_2100_2200: "21:00", SLOT_2200_2300: "22:00", SLOT_2300_0000: "23:00",
    SLOT_0000_0100: "00:00", SLOT_0100_0200: "01:00", SLOT_0200_0300: "02:00", SLOT_0300_0400: "03:00",
    SLOT_0400_0500: "04:00", SLOT_0500_0600: "05:00", SLOT_0600_0700: "06:00", SLOT_0700_0800: "07:00"
  };
  let inspectionStartedAt: Date | null = null;
  let inspectionCompletedAt: Date | null = null;
  if (durationMinutes && inspectedAt) {
    const [h, m] = (SLOT_START[timeSlot] ?? "08:00").split(":").map(Number);
    const base = inspectedAt;
    inspectionStartedAt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
    inspectionCompletedAt = new Date(inspectionStartedAt.getTime() + durationMinutes * 60_000);
  }

  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, include: { category: true } });
  if (!report || !asset || report.status === "LOCKED") redirect(returnTo);
  if (asset.category.code === "BACKUP" && isGeneratedBackupJobAssetCode(asset.code)) redirect(returnTo);
  if (!validateDay(report.month, report.buddhistYear, day)) redirect(returnTo);
  if (!validateStatusCode(asset.category.code, statusCode)) redirect(returnTo);
  const backdateMeta = normalSaveMeta();

  await prisma.dailyStatusEntry.upsert({
    where: { reportId_assetId_day: { reportId, assetId, day } },
    update: { statusCode, timeSlot, inspectionShift, inspectedAt, durationMinutes, inspectionStartedAt, inspectionCompletedAt, note, ...backdateMeta, updatedById: user.id },
    create: { reportId, assetId, day, timeSlot, inspectionShift, inspectedAt, durationMinutes, inspectionStartedAt, inspectionCompletedAt, statusCode, note, ...backdateMeta, recordedById: user.id, updatedById: user.id }
  });

  revalidatePath(`/reports/${reportId}`);
  revalidateLocalPath(returnTo);
  redirect(appendRefreshParam(returnTo));
}

export async function upsertStatusActionClient(formData: FormData): Promise<{ ok: boolean; redirectTo?: string; error?: string }> {
  try {
    const user = await requireUser();
    if (!canEditRole(user.role)) return { ok: false, error: "Unauthorized" };

    const reportId = String(formData.get("reportId"));
    const assetId = String(formData.get("assetId"));
    const day = Number(formData.get("day"));
    const statusCode = String(formData.get("statusCode"));
    const note = String(formData.get("note") ?? "").trim() || null;
    const returnTo = safeLocalPath(formData.get("returnTo"), `/reports/${reportId}`);
    const timeSlotRaw = formData.get("timeSlot");
    const timeSlot = (timeSlotRaw ? parseTimeSlot(timeSlotRaw) : null) ?? ("SLOT_0800_0900" as InspectionTimeSlot);
    const inspectionShift = parseInspectionShift(formData.get("inspectionShift")) ?? getShiftForTimeSlot(timeSlot);
    const inspectedAt = parseOptionalDateTime(formData.get("inspectedAt"));
    const durationMinutesRaw = Number(formData.get("durationMinutes") ?? 0);
    const durationMinutes = Number.isFinite(durationMinutesRaw) && [5, 10, 15, 30, 45, 60].includes(durationMinutesRaw)
      ? durationMinutesRaw : null;
    const SLOT_START: Record<string, string> = {
      SLOT_0800_0900: "08:00", SLOT_0900_1000: "09:00", SLOT_1000_1100: "10:00", SLOT_1100_1200: "11:00",
      SLOT_1200_1300: "12:00", SLOT_1300_1400: "13:00", SLOT_1400_1500: "14:00", SLOT_1500_1600: "15:00",
      SLOT_1600_1700: "16:00", SLOT_1700_1800: "17:00", SLOT_1800_1900: "18:00", SLOT_1900_2000: "19:00",
      SLOT_2000_2100: "20:00", SLOT_2100_2200: "21:00", SLOT_2200_2300: "22:00", SLOT_2300_0000: "23:00",
      SLOT_0000_0100: "00:00", SLOT_0100_0200: "01:00", SLOT_0200_0300: "02:00", SLOT_0300_0400: "03:00",
      SLOT_0400_0500: "04:00", SLOT_0500_0600: "05:00", SLOT_0600_0700: "06:00", SLOT_0700_0800: "07:00"
    };
    let inspectionStartedAt: Date | null = null;
    let inspectionCompletedAt: Date | null = null;
    if (durationMinutes && inspectedAt) {
      const [h, m] = (SLOT_START[timeSlot] ?? "08:00").split(":").map(Number);
      const base = inspectedAt;
      inspectionStartedAt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
      inspectionCompletedAt = new Date(inspectionStartedAt.getTime() + durationMinutes * 60_000);
    }
    const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
    const asset = await prisma.asset.findUnique({ where: { id: assetId }, include: { category: true } });
    if (!report || !asset || report.status === "LOCKED") return { ok: false, error: "Invalid report or asset" };
    if (asset.category.code === "BACKUP" && isGeneratedBackupJobAssetCode(asset.code)) return { ok: false, error: "Invalid asset" };
    if (!validateDay(report.month, report.buddhistYear, day)) return { ok: false, error: "Invalid day" };
    if (!validateStatusCode(asset.category.code, statusCode)) return { ok: false, error: "Invalid status" };
    const backdateMeta = normalSaveMeta();
    await prisma.dailyStatusEntry.upsert({
      where: { reportId_assetId_day: { reportId, assetId, day } },
      update: { statusCode, timeSlot, inspectionShift, inspectedAt, durationMinutes, inspectionStartedAt, inspectionCompletedAt, note, ...backdateMeta, updatedById: user.id },
      create: { reportId, assetId, day, timeSlot, inspectionShift, inspectedAt, durationMinutes, inspectionStartedAt, inspectionCompletedAt, statusCode, note, ...backdateMeta, recordedById: user.id, updatedById: user.id }
    });
    revalidatePath(`/reports/${reportId}`);
    revalidateLocalPath(returnTo);
    return { ok: true, redirectTo: appendRefreshParam(returnTo) };
  } catch {
    return { ok: false, error: "Server error" };
  }
}

export async function bulkUpsertStatusAction(formData: FormData) {
  const user = await requireUser();
  if (!canEditRole(user.role)) redirect("/");

  const reportId = String(formData.get("reportId"));
  const categoryCode = String(formData.get("categoryCode")) as AssetCategoryCode;
  const day = Number(formData.get("day"));
  const statusCode = String(formData.get("statusCode"));
  const applyAllActive = formData.get("applyAllActive") === "true";
  const assetIds = formData.getAll("assetIds").map(String).filter(Boolean);
  const returnTo = safeLocalPath(formData.get("returnTo"), `/reports/${reportId}`);

  const rawSlots = formData.getAll("timeSlots");
  const slotsToProcess: InspectionTimeSlot[] = rawSlots
    .map((v) => parseTimeSlot(v))
    .filter((s): s is InspectionTimeSlot => s !== null);
  const slots = slotsToProcess.length > 0 ? slotsToProcess : ["SLOT_0800_0900" as InspectionTimeSlot];
  const timeSlot = slots[0] ?? ("SLOT_0800_0900" as InspectionTimeSlot);
  const inspectionShift = parseInspectionShift(formData.get("inspectionShift")) ?? getShiftForTimeSlot(timeSlot);
  const inspectedAt = parseOptionalDateTime(formData.get("inspectedAt"));
  const bulkDurRaw = Number(formData.get("durationMinutes") ?? 0);
  const durationMinutes = Number.isFinite(bulkDurRaw) && [5, 10, 15, 30, 45, 60].includes(bulkDurRaw)
    ? bulkDurRaw : null;
  const SLOT_START_BULK: Record<string, string> = {
    SLOT_0800_0900: "08:00", SLOT_0900_1000: "09:00", SLOT_1000_1100: "10:00", SLOT_1100_1200: "11:00",
    SLOT_1200_1300: "12:00", SLOT_1300_1400: "13:00", SLOT_1400_1500: "14:00", SLOT_1500_1600: "15:00",
    SLOT_1600_1700: "16:00", SLOT_1700_1800: "17:00", SLOT_1800_1900: "18:00", SLOT_1900_2000: "19:00",
    SLOT_2000_2100: "20:00", SLOT_2100_2200: "21:00", SLOT_2200_2300: "22:00", SLOT_2300_0000: "23:00",
    SLOT_0000_0100: "00:00", SLOT_0100_0200: "01:00", SLOT_0200_0300: "02:00", SLOT_0300_0400: "03:00",
    SLOT_0400_0500: "04:00", SLOT_0500_0600: "05:00", SLOT_0600_0700: "06:00", SLOT_0700_0800: "07:00"
  };
  let bulkInspectionStartedAt: Date | null = null;
  let bulkInspectionCompletedAt: Date | null = null;
  if (durationMinutes && inspectedAt) {
    const [h, m] = (SLOT_START_BULK[timeSlot] ?? "08:00").split(":").map(Number);
    bulkInspectionStartedAt = new Date(inspectedAt.getFullYear(), inspectedAt.getMonth(), inspectedAt.getDate(), h, m, 0, 0);
    bulkInspectionCompletedAt = new Date(bulkInspectionStartedAt.getTime() + durationMinutes * 60_000);
  }

  if (!["VM", "SERVER", "NETWORK", "STORAGE", "BACKUP"].includes(categoryCode)) redirect(returnTo);
  if (!applyAllActive && assetIds.length === 0) redirect(returnTo);

  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report || report.status === "LOCKED") redirect(returnTo);
  if (!validateDay(report.month, report.buddhistYear, day)) redirect(returnTo);
  if (!validateStatusCode(categoryCode, statusCode)) redirect(returnTo);
  const backdateMeta = normalSaveMeta();

  const uniqueAssetIds = Array.from(new Set(assetIds));
  const assetScope = generatedBackupJobAssetExclusion(categoryCode);
  const assets = await prisma.asset.findMany({
    where: applyAllActive
      ? { active: true, category: { code: categoryCode }, ...assetScope }
      : {
          id: { in: uniqueAssetIds },
          active: true,
          category: { code: categoryCode },
          ...assetScope
        },
    select: { id: true }
  });
  if (!applyAllActive && assets.length !== uniqueAssetIds.length) redirect(returnTo);
  if (assets.length === 0) redirect(returnTo);

  await prisma.$transaction(
    assets.map((asset) => prisma.dailyStatusEntry.upsert({
      where: { reportId_assetId_day: { reportId, assetId: asset.id, day } },
      update: { statusCode, timeSlot, inspectionShift, inspectedAt, durationMinutes, inspectionStartedAt: bulkInspectionStartedAt, inspectionCompletedAt: bulkInspectionCompletedAt, note: null, ...backdateMeta, updatedById: user.id },
      create: { reportId, assetId: asset.id, day, timeSlot, inspectionShift, inspectedAt, durationMinutes, inspectionStartedAt: bulkInspectionStartedAt, inspectionCompletedAt: bulkInspectionCompletedAt, statusCode, note: null, ...backdateMeta, recordedById: user.id, updatedById: user.id }
    }))
  );

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "BULK_UPSERT_STATUS",
      entityType: "DailyStatusEntry",
      entityId: reportId,
      detail: { categoryCode, day, statusCode, count: assets.length, applyAllActive }
    }
  });

  revalidatePath(`/reports/${reportId}`);
  revalidateLocalPath(returnTo);
  redirect(appendRefreshParam(returnTo));
}

export async function bulkUpsertStatusRangeAction(formData: FormData) {
  const user = await requireUser();
  if (!canEditRole(user.role)) return { ok: false, error: "unauthorized" };

  const reportId = String(formData.get("reportId"));
  const categoryCode = String(formData.get("categoryCode")) as AssetCategoryCode;
  const startDay = Number(formData.get("startDay"));
  const endDay = Number(formData.get("endDay"));
  const statusCode = String(formData.get("statusCode"));
  const returnTo = safeLocalPath(formData.get("returnTo"), `/reports/${reportId}`);

  const rawSlots = formData.getAll("timeSlots");
  const slotsToProcess: InspectionTimeSlot[] = rawSlots
    .map((v) => parseTimeSlot(v))
    .filter((s): s is InspectionTimeSlot => s !== null);
  const slots = slotsToProcess.length > 0 ? slotsToProcess : ["SLOT_0800_0900" as InspectionTimeSlot];

  if (!["VM", "SERVER", "NETWORK", "STORAGE", "BACKUP"].includes(categoryCode)) return { ok: false, error: "invalid_category" };

  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report || report.status === "LOCKED") return { ok: false, error: "invalid_report" };
  if (startDay > endDay) return { ok: false, error: "invalid_range" };
  if (!validateStatusCode(categoryCode, statusCode)) return { ok: false, error: "invalid_status" };
  if (!validateDay(report.month, report.buddhistYear, startDay) || !validateDay(report.month, report.buddhistYear, endDay)) {
    return { ok: false, error: "invalid_day" };
  }

  const assets = await prisma.asset.findMany({
    where: { active: true, category: { code: categoryCode }, ...generatedBackupJobAssetExclusion(categoryCode) },
    select: { id: true }
  });
  if (assets.length === 0) return { ok: false, error: "no_assets" };

  const rawDur = Number(formData.get("durationMinutes") ?? 0);
  const durationMinutes = Number.isFinite(rawDur) && [5, 10, 15, 30, 45, 60].includes(rawDur) ? rawDur : null;

  const days = Array.from({ length: endDay - startDay + 1 }, (_, index) => startDay + index);
  const timeSlot = slots[0] ?? ("SLOT_0800_0900" as InspectionTimeSlot);
  const inspectionShift = getShiftForTimeSlot(timeSlot);
  const backdateMeta = normalSaveMeta();
  await prisma.$transaction(
    days.flatMap((day) =>
      assets.map((asset) => prisma.dailyStatusEntry.upsert({
        where: { reportId_assetId_day: { reportId, assetId: asset.id, day } },
        update: { statusCode, timeSlot, inspectionShift, durationMinutes, note: null, ...backdateMeta, updatedById: user.id },
        create: { reportId, assetId: asset.id, day, timeSlot, inspectionShift, statusCode, durationMinutes, note: null, ...backdateMeta, recordedById: user.id, updatedById: user.id }
      }))
    )
  );

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "BULK_UPSERT_STATUS_RANGE",
      entityType: "DailyStatusEntry",
      entityId: reportId,
      detail: { categoryCode, startDay, endDay, statusCode, count: assets.length * days.length }
    }
  });

  revalidatePath(`/reports/${reportId}`);
  revalidateLocalPath(returnTo);
  return { ok: true, updated: assets.length * days.length };
}

export async function resetDayEntriesAction(formData: FormData) {
  const user = await requireUser();
  if (!canEditRole(user.role)) redirect("/");

  const reportId = String(formData.get("reportId"));
  const categoryCode = String(formData.get("categoryCode")) as AssetCategoryCode;
  const day = Number(formData.get("day"));
  const returnTo = safeLocalPath(formData.get("returnTo"), `/reports/${reportId}`);

  if (!["VM", "SERVER", "NETWORK", "STORAGE", "BACKUP"].includes(categoryCode)) redirect(returnTo);

  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report || report.status === "LOCKED") redirect(returnTo);
  if (!validateDay(report.month, report.buddhistYear, day)) redirect(returnTo);

  const assets = await prisma.asset.findMany({
    where: { category: { code: categoryCode }, ...generatedBackupJobAssetExclusion(categoryCode) },
    select: { id: true }
  });
  const assetIds = assets.map((a) => a.id);
  if (assetIds.length === 0) redirect(returnTo);

  const result = await prisma.dailyStatusEntry.deleteMany({ where: { reportId, day, assetId: { in: assetIds } } });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "RESET_DAY_ENTRIES",
      entityType: "DailyStatusEntry",
      entityId: reportId,
      detail: { categoryCode, day, count: result.count }
    }
  });

  revalidatePath(`/reports/${reportId}`);
  revalidateLocalPath(returnTo);
  redirect(appendRefreshParam(returnTo));
}

export async function resetDayEntriesRangeAction(formData: FormData) {
  const user = await requireUser();
  if (!canEditRole(user.role)) return { ok: false, error: "unauthorized", deleted: 0 };

  const reportId = String(formData.get("reportId"));
  const categoryCode = String(formData.get("categoryCode")) as AssetCategoryCode;
  const startDay = Number(formData.get("startDay"));
  const endDay = Number(formData.get("endDay"));
  const returnTo = safeLocalPath(formData.get("returnTo"), `/reports/${reportId}`);

  if (!["VM", "SERVER", "NETWORK", "STORAGE", "BACKUP"].includes(categoryCode)) {
    return { ok: false, error: "invalid_category", deleted: 0 };
  }
  if (!Number.isInteger(startDay) || !Number.isInteger(endDay) || startDay > endDay) {
    return { ok: false, error: "invalid_range", deleted: 0 };
  }

  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report || report.status === "LOCKED") return { ok: false, error: "invalid_report", deleted: 0 };
  if (!validateDay(report.month, report.buddhistYear, startDay) || !validateDay(report.month, report.buddhistYear, endDay)) {
    return { ok: false, error: "invalid_day", deleted: 0 };
  }

  const assets = await prisma.asset.findMany({
    where: { category: { code: categoryCode }, ...generatedBackupJobAssetExclusion(categoryCode) },
    select: { id: true }
  });
  const assetIds = assets.map((a) => a.id);
  if (assetIds.length === 0) return { ok: true, deleted: 0 };

  const result = await prisma.dailyStatusEntry.deleteMany({
    where: {
      reportId,
      day: { gte: startDay, lte: endDay },
      assetId: { in: assetIds }
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "RESET_DAY_ENTRIES_RANGE",
      entityType: "DailyStatusEntry",
      entityId: reportId,
      detail: { categoryCode, startDay, endDay, count: result.count }
    }
  });

  revalidatePath(`/reports/${reportId}`);
  revalidateLocalPath(returnTo);
  return { ok: true, deleted: result.count };
}

export async function deleteReportAction(formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  const reportId = String(formData.get("reportId"));
  if (!reportId) redirect("/reports");

  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report) redirect("/reports");

  await prisma.$transaction([
    prisma.monthlyReport.delete({ where: { id: reportId } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE_REPORT",
        entityType: "MonthlyReport",
        entityId: reportId,
        detail: { month: report.month, buddhistYear: report.buddhistYear, status: report.status }
      }
    })
  ]);

  revalidatePath("/reports");
  revalidatePath("/");
  redirect("/reports");
}

export async function reviewReportAction(formData: FormData) {
  const user = await requireUser();
  if (!canReviewRole(user.role)) redirect("/");

  const reportId = String(formData.get("reportId"));
  const reviewerName = String(formData.get("reviewerName") ?? "").trim();
  const lock = formData.get("lock") === "on";

  await prisma.monthlyReport.update({
    where: { id: reportId },
    data: {
      reviewerName,
      reviewedById: user.id,
      reviewedAt: new Date(),
      status: lock ? "LOCKED" : "REVIEWED",
      lockedAt: lock ? new Date() : null
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: lock ? "LOCK_REPORT" : "REVIEW_REPORT",
      entityType: "MonthlyReport",
      entityId: reportId
    }
  });

  revalidatePath(`/reports/${reportId}`);
}

function optionalText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function optionalDate(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return parseBuddhistDateInput(value);
}

function parseQuantityField(formData: FormData, key: string) {
  const value = String(formData.get(`${key}Value`) ?? "").trim();
  const unit = String(formData.get(`${key}Unit`) ?? "").trim();
  if (value) {
    return unit ? `${value} ${unit}` : value;
  }
  return String(formData.get(key) ?? "").trim() || null;
}

function assetDetailData(formData: FormData, submittedOnly = false) {
  const textKeys = ["deviceType", "model", "brand", "os", "assetNumber", "ipAddress", "location", "ownershipType", "building", "floor", "databaseType", "databaseServer"] as const;
  const detail = Object.fromEntries(
    textKeys
      .filter((key) => !submittedOnly || formData.has(key))
      .map((key) => [key, optionalText(formData, key)])
  ) as Record<string, string | null>;

  for (const quantityKey of ["cpu", "ram", "disk"] as const) {
    if (!submittedOnly || formData.has(`${quantityKey}Value`) || formData.has(quantityKey)) {
      detail[quantityKey] = parseQuantityField(formData, quantityKey);
    }
  }

  if (!submittedOnly || formData.has("installedAt")) {
    return { ...detail, installedAt: optionalDate(formData, "installedAt") };
  }

  return detail;
}

export async function addAssetAction(formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  const categoryId = String(formData.get("categoryId"));
  const name = String(formData.get("name") ?? "").trim();
  const detail = assetDetailData(formData);
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/assets");
  if (!name) redirect(returnTo);

  const last = await prisma.asset.findFirst({
    where: { categoryId },
    orderBy: { displayOrder: "desc" }
  });

  const asset = await prisma.asset.create({
    data: {
      categoryId,
      name,
      ...detail,
      displayOrder: (last?.displayOrder ?? 0) + 1
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CREATE_ASSET",
      entityType: "Asset",
      entityId: asset.id,
      detail: { name, ...detail }
    }
  });

  revalidatePath("/admin/assets");
  revalidatePath("/admin/assets/print");
  revalidateLocalPath(returnTo);
}

export async function addAssetActionClient(formData: FormData): Promise<{ ok: boolean }> {
  const user = await requireUser(["ADMIN"]);
  const categoryId = String(formData.get("categoryId"));
  const name = String(formData.get("name") ?? "").trim();
  const detail = assetDetailData(formData);
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/assets");
  if (!name) return { ok: false };

  const last = await prisma.asset.findFirst({
    where: { categoryId },
    orderBy: { displayOrder: "desc" }
  });

  const asset = await prisma.asset.create({
    data: {
      categoryId,
      name,
      ...detail,
      displayOrder: (last?.displayOrder ?? 0) + 1
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CREATE_ASSET",
      entityType: "Asset",
      entityId: asset.id,
      detail: { name, ...detail }
    }
  });

  revalidatePath("/admin/assets");
  revalidatePath("/admin/assets/print");
  revalidateLocalPath(returnTo);
  return { ok: true };
}

export async function updateAssetAction(formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  const assetId = String(formData.get("assetId"));
  const name = String(formData.get("name") ?? "").trim();
  const detail = assetDetailData(formData, true);
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/assets");
  if (!assetId || !name) redirect(returnTo);

  await prisma.asset.update({
    where: { id: assetId },
    data: { name, ...detail }
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "UPDATE_ASSET",
      entityType: "Asset",
      entityId: assetId,
      detail: { name, ...detail }
    }
  });

  revalidatePath("/admin/assets");
  revalidatePath("/admin/assets/print");
  revalidateLocalPath(returnTo);
}

export async function updateAssetActionClient(formData: FormData): Promise<{ ok: boolean }> {
  const user = await requireUser(["ADMIN"]);
  const assetId = String(formData.get("assetId"));
  const name = String(formData.get("name") ?? "").trim();
  const detail = assetDetailData(formData, true);
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/assets");
  if (!assetId || !name) return { ok: false };

  await prisma.asset.update({
    where: { id: assetId },
    data: { name, ...detail }
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "UPDATE_ASSET",
      entityType: "Asset",
      entityId: assetId,
      detail: { name, ...detail }
    }
  });

  revalidatePath("/admin/assets");
  revalidatePath("/admin/assets/print");
  revalidateLocalPath(returnTo);
  return { ok: true };
}

export async function addAssetOptionAction(formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  const type = parseAssetOptionType(formData.get("type"));
  const value = String(formData.get("value") ?? "").trim();
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/settings/basic");

  if (!type || !value) redirect(appendLocalParam(returnTo, "error", "invalid"));

  const existing = await prisma.assetOption.findUnique({
    where: { type_value: { type, value } }
  });
  if (existing) redirect(appendLocalParam(returnTo, "error", "duplicate"));

  const last = await prisma.assetOption.findFirst({
    where: { type },
    orderBy: { displayOrder: "desc" }
  });

  const option = await prisma.assetOption.create({
    data: {
      type,
      value,
      displayOrder: (last?.displayOrder ?? 0) + 1
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CREATE_ASSET_OPTION",
      entityType: "AssetOption",
      entityId: option.id,
      detail: { type, value }
    }
  });

  revalidateAssetOptionPaths(returnTo);
  redirect(appendLocalParam(returnTo, "saved", "1"));
}

export async function updateAssetOptionAction(formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  const optionId = String(formData.get("optionId") ?? "");
  const value = String(formData.get("value") ?? "").trim();
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/settings/basic");

  if (!optionId || !value) redirect(appendLocalParam(returnTo, "error", "invalid"));

  const option = await prisma.assetOption.findUnique({ where: { id: optionId } });
  if (!option) redirect(appendLocalParam(returnTo, "error", "not-found"));

  const duplicate = await prisma.assetOption.findFirst({
    where: {
      id: { not: optionId },
      type: option.type,
      value
    }
  });
  if (duplicate) redirect(appendLocalParam(returnTo, "error", "duplicate"));

  await prisma.assetOption.update({
    where: { id: optionId },
    data: { value }
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "UPDATE_ASSET_OPTION",
      entityType: "AssetOption",
      entityId: optionId,
      detail: { type: option.type, previousValue: option.value, value }
    }
  });

  revalidateAssetOptionPaths(returnTo);
  redirect(appendLocalParam(returnTo, "saved", "1"));
}

export async function deleteAssetOptionAction(formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  const optionId = String(formData.get("optionId") ?? "");
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/settings/basic");

  if (!optionId) redirect(appendLocalParam(returnTo, "error", "invalid"));

  const option = await prisma.assetOption.findUnique({ where: { id: optionId } });
  if (!option) redirect(appendLocalParam(returnTo, "error", "not-found"));

  await prisma.$transaction([
    prisma.assetOption.delete({ where: { id: optionId } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE_ASSET_OPTION",
        entityType: "AssetOption",
        entityId: optionId,
        detail: { type: option.type, value: option.value }
      }
    })
  ]);

  revalidateAssetOptionPaths(returnTo);
  redirect(appendLocalParam(returnTo, "saved", "1"));
}

export async function deleteAssetAction(formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  const assetId = String(formData.get("assetId"));
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/assets");
  if (!assetId) redirect(returnTo);

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { category: true }
  });
  if (!asset) redirect(returnTo);

  await prisma.$transaction([
    prisma.dailyStatusEntry.deleteMany({ where: { assetId } }),
    prisma.serverMetricLog.deleteMany({ where: { serverAssetId: assetId } }),
    prisma.asset.delete({ where: { id: assetId } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE_ASSET",
        entityType: "Asset",
        entityId: assetId,
        detail: { name: asset.name, category: asset.category.code }
      }
    })
  ]);

  revalidatePath("/admin/assets");
  revalidatePath("/admin/assets/vm");
  revalidatePath("/admin/assets/host");
  revalidatePath("/admin/assets/network");
  revalidatePath("/admin/assets/backup");
  revalidatePath("/servers");
  revalidatePath("/admin/assets/print");
  revalidateLocalPath(returnTo);
}

export async function createUserAction(formData: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const username = String(formData.get("username") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "OPERATOR") as Role;
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/users");

  if (!username || !displayName || password.length < 8) redirect(appendLocalParam(returnTo, "error", "invalid"));
  if (!["ADMIN", "OPERATOR"].includes(role)) redirect(appendLocalParam(returnTo, "error", "invalid"));

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, displayName, email, passwordHash, role, mustChangePassword: true }
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "CREATE_USER",
      entityType: "User",
      entityId: user.id,
      detail: { username, role, email }
    }
  });

  revalidatePath("/admin/users");
  redirect(appendLocalParam(returnTo, "updated", "create"));
}

export async function resetUserPasswordAction(formData: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/users");

  if (!userId || password.length < 8) redirect(appendLocalParam(returnTo, "error", "invalid"));
  if (admin.id === userId) redirect(appendLocalParam(returnTo, "error", "self-reset"));

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) redirect(appendLocalParam(returnTo, "error", "invalid"));

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true }
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "RESET_USER_PASSWORD",
      entityType: "User",
      entityId: userId,
      detail: { username: target.username }
    }
  });

  revalidatePath("/admin/users");
  redirect(appendLocalParam(returnTo, "updated", "reset"));
}

export async function toggleUserAction(formData: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const userId = String(formData.get("userId"));
  const active = formData.get("active") === "true";
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/users");

  if (admin.id === userId && !active) redirect(appendLocalParam(returnTo, "error", "self"));

  await prisma.user.update({ where: { id: userId }, data: { active } });
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: active ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      entityType: "User",
      entityId: userId
    }
  });

  revalidatePath("/admin/users");
  redirect(appendLocalParam(returnTo, "updated", active ? "activated" : "deactivated"));
}

export async function updateUserAction(formData: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const userId = String(formData.get("userId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "");
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/users");

  if (!userId || !displayName || !["ADMIN", "OPERATOR"].includes(role)) {
    redirect(appendLocalParam(returnTo, "error", "invalid"));
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) redirect(appendLocalParam(returnTo, "error", "invalid"));

  await prisma.user.update({
    where: { id: userId },
    data: { displayName, email, role: role as Role }
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: userId,
      detail: { username: target.username, previousRole: target.role, newRole: role, previousDisplayName: target.displayName, newDisplayName: displayName, previousEmail: target.email, newEmail: email }
    }
  });

  revalidatePath("/admin/users");
  redirect(appendLocalParam(returnTo, "updated", "user"));
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const userId = String(formData.get("userId") ?? "");
  const confirmUsername = String(formData.get("confirmUsername") ?? "").trim();
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/users");

  if (!userId) redirect(appendLocalParam(returnTo, "error", "invalid"));
  if (admin.id === userId) redirect(appendLocalParam(returnTo, "error", "self"));

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || confirmUsername !== target.username) redirect(appendLocalParam(returnTo, "error", "invalid"));

  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { userId } }),
    prisma.serverMetricLog.deleteMany({ where: { createdById: userId } }),
    prisma.serverMetricEntry.deleteMany({ where: { recordedById: userId } }),
    prisma.serverMetricEntry.updateMany({ where: { updatedById: userId }, data: { updatedById: admin.id } }),
    prisma.activityLog.deleteMany({ where: { inspectorName: target.displayName } }),
    prisma.dailyStatusEntry.deleteMany({ where: { recordedById: userId } }),
    prisma.dailyStatusEntry.updateMany({ where: { updatedById: userId }, data: { updatedById: admin.id } }),
    prisma.user.delete({ where: { id: userId } }),
    prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "DELETE_USER",
        entityType: "User",
        entityId: userId,
        detail: { username: target.username, role: target.role, displayName: target.displayName }
      }
    })
  ]);

  revalidatePath("/admin/users");
  redirect(appendLocalParam(returnTo, "updated", "deleted"));
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeLocalPath(formData.get("returnTo"), "/profile");

  const displayName = String(formData.get("displayName") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim() || null;
  const department = String(formData.get("department") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!displayName) redirect(`${returnTo}?error=invalid`);

  await prisma.user.update({
    where: { id: user.id },
    data: { displayName, position, department, email, phone }
  });

  revalidatePath("/profile");
  redirect(`${returnTo}?updated=profile`);
}

export async function toggleAssetAction(formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  const assetId = String(formData.get("assetId"));
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/assets");
  const active = formData.get("active") === "true";

  await prisma.asset.update({ where: { id: assetId }, data: { active } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: active ? "ACTIVATE_ASSET" : "DEACTIVATE_ASSET",
      entityType: "Asset",
      entityId: assetId
    }
  });

  revalidatePath("/admin/assets");
  revalidatePath("/admin/assets/vm");
  revalidatePath("/admin/assets/host");
  revalidatePath("/admin/assets/network");
  revalidatePath("/admin/assets/backup");
  revalidatePath("/admin/assets/print");
  revalidateLocalPath(returnTo);
}

function metricNumber(formData: FormData, key: string) {
  return Number(formData.get(key));
}

export async function addServerMetricAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeLocalPath(formData.get("returnTo"), "/servers");
  if (!canEditRole(user.role)) redirect(returnTo);

  const reportId = String(formData.get("reportId"));
  const serverAssetId = String(formData.get("serverAssetId"));
  const measuredAt = new Date(String(formData.get("measuredAt")));
  const cpuPercent = metricNumber(formData, "cpuPercent");
  const ramUsedGb = metricNumber(formData, "ramUsedGb");
  const diskUsedGb = metricNumber(formData, "diskUsedGb");
  const note = String(formData.get("note") ?? "").trim() || null;
  const metricErrorPath = appendLocalParam(returnTo, "error", "metric");
  const assetTotalErrorPath = appendLocalParam(returnTo, "error", "asset-total");

  const [report, serverAsset] = await Promise.all([
    prisma.monthlyReport.findUnique({ where: { id: reportId } }),
    prisma.asset.findUnique({ where: { id: serverAssetId }, include: { category: true } })
  ]);
  if (!report || report.status === "LOCKED") redirect(returnTo);
  if (!serverAsset || !serverAsset.active || !["VM", "SERVER"].includes(serverAsset.category.code)) {
    redirect(metricErrorPath);
  }

  const ramTotalGb = parseAssetCapacityGb(serverAsset.ram);
  const diskTotalGb = parseAssetCapacityGb(serverAsset.disk);
  if (ramTotalGb === null || diskTotalGb === null) {
    redirect(assetTotalErrorPath);
  }

  if (
    Number.isNaN(measuredAt.getTime()) ||
    !Number.isFinite(cpuPercent) ||
    !Number.isFinite(ramUsedGb) ||
    !Number.isFinite(diskUsedGb) ||
    cpuPercent < 0 ||
    cpuPercent > 100 ||
    ramUsedGb < 0 ||
    diskUsedGb < 0 ||
    ramUsedGb > ramTotalGb ||
    diskUsedGb > diskTotalGb
  ) {
    redirect(metricErrorPath);
  }

  await prisma.serverMetricLog.create({
    data: {
      reportId,
      serverAssetId,
      measuredAt,
      cpuPercent,
      ramUsedGb,
      ramTotalGb,
      diskUsedGb,
      diskTotalGb,
      note,
      createdById: user.id
    }
  });

  revalidatePath("/servers");
  revalidateLocalPath(returnTo);
}

export async function updateServerMetricAction(formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  const returnTo = safeLocalPath(formData.get("returnTo"), "/servers");
  const metricId = String(formData.get("metricId") ?? "");
  const serverAssetId = String(formData.get("serverAssetId") ?? "");
  const measuredAt = new Date(String(formData.get("measuredAt")));
  const cpuPercent = metricNumber(formData, "cpuPercent");
  const ramUsedGb = metricNumber(formData, "ramUsedGb");
  const diskUsedGb = metricNumber(formData, "diskUsedGb");
  const note = String(formData.get("note") ?? "").trim() || null;
  const metricErrorPath = appendLocalParam(returnTo, "error", "metric");
  const assetTotalErrorPath = appendLocalParam(returnTo, "error", "asset-total");

  if (!metricId || !serverAssetId) redirect(metricErrorPath);

  const [metric, serverAsset] = await Promise.all([
    prisma.serverMetricLog.findUnique({ where: { id: metricId } }),
    prisma.asset.findUnique({ where: { id: serverAssetId }, include: { category: true } })
  ]);
  if (!metric) redirect(appendLocalParam(returnTo, "error", "metric-not-found"));
  if (!serverAsset || !["VM", "SERVER"].includes(serverAsset.category.code)) {
    redirect(metricErrorPath);
  }

  const ramTotalGb = parseAssetCapacityGb(serverAsset.ram);
  const diskTotalGb = parseAssetCapacityGb(serverAsset.disk);
  if (ramTotalGb === null || diskTotalGb === null) {
    redirect(assetTotalErrorPath);
  }

  if (
    Number.isNaN(measuredAt.getTime()) ||
    !Number.isFinite(cpuPercent) ||
    !Number.isFinite(ramUsedGb) ||
    !Number.isFinite(diskUsedGb) ||
    cpuPercent < 0 ||
    cpuPercent > 100 ||
    ramUsedGb < 0 ||
    diskUsedGb < 0 ||
    ramUsedGb > ramTotalGb ||
    diskUsedGb > diskTotalGb
  ) {
    redirect(metricErrorPath);
  }

  await prisma.$transaction([
    prisma.serverMetricLog.update({
      where: { id: metricId },
      data: {
        serverAssetId,
        measuredAt,
        cpuPercent,
        ramUsedGb,
        ramTotalGb,
        diskUsedGb,
        diskTotalGb,
        note
      }
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_SERVER_METRIC",
        entityType: "ServerMetricLog",
        entityId: metricId,
        detail: { serverAssetId, measuredAt, cpuPercent, ramUsedGb, ramTotalGb, diskUsedGb, diskTotalGb, note }
      }
    })
  ]);

  revalidatePath("/servers");
  revalidateLocalPath(returnTo);
}

export async function deleteServerMetricAction(formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  const returnTo = safeLocalPath(formData.get("returnTo"), "/servers");
  const metricId = String(formData.get("metricId") ?? "");
  if (!metricId) redirect(appendLocalParam(returnTo, "error", "metric"));

  const metric = await prisma.serverMetricLog.findUnique({
    where: { id: metricId },
    include: { serverAsset: true }
  });
  if (!metric) redirect(appendLocalParam(returnTo, "error", "metric-not-found"));

  await prisma.$transaction([
    prisma.serverMetricLog.delete({ where: { id: metricId } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE_SERVER_METRIC",
        entityType: "ServerMetricLog",
        entityId: metricId,
        detail: {
          serverAssetId: metric.serverAssetId,
          serverName: metric.serverAsset.name,
          measuredAt: metric.measuredAt,
          cpuPercent: metric.cpuPercent,
          ramUsedGb: metric.ramUsedGb,
          ramTotalGb: metric.ramTotalGb,
          diskUsedGb: metric.diskUsedGb,
          diskTotalGb: metric.diskTotalGb,
          note: metric.note
        }
      }
    })
  ]);

  revalidatePath("/servers");
  revalidateLocalPath(returnTo);
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser(undefined, { allowPasswordChange: true });
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const returnTo = safeLocalPath(formData.get("returnTo"), "/profile");

  if (!currentPassword || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
    redirect(appendLocalParam(returnTo, "error", "invalid"));
  }

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record || !(await bcrypt.compare(currentPassword, record.passwordHash))) {
    redirect(appendLocalParam(returnTo, "error", "wrong"));
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CHANGE_PASSWORD",
      entityType: "User",
      entityId: user.id
    }
  });

  redirect(appendLocalParam("/profile", "updated", "1"));
}

export async function createTwoFactorSetupAction(formData?: FormData) {
  const user = await requireUser();
  const setup = createTotpSecret(user.username);
  const returnTo = String(formData?.get("returnTo") ?? "/security");
  const target = returnTo === "/profile" ? "/profile" : "/security";

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorSecret: setup.secret,
      twoFactorEnabled: false
    }
  });

  redirect(`${target}?setup=1`);
}

export async function verifyTwoFactorAction(formData: FormData) {
  const user = await requireUser();
  const token = String(formData.get("token") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/security");
  const target = returnTo === "/profile" ? "/profile" : "/security";
  const record = await prisma.user.findUnique({ where: { id: user.id } });

  if (!record?.twoFactorSecret || !verifyTotp(token, record.twoFactorSecret)) {
    redirect(`${target}?error=totp&setup=1`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true }
  });

  redirect(`${target}?enabled=1`);
}

// Data Center Actions (Admin only)
export async function createDataCenterAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "unauthorized" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!name) {
    return { error: "name_required" };
  }

  const maxOrder = await prisma.dataCenter.findFirst({
    where: { active: true },
    orderBy: { displayOrder: "desc" }
  });

  await prisma.dataCenter.create({
    data: {
      name,
      location,
      description,
      displayOrder: (maxOrder?.displayOrder ?? 0) + 1
    }
  });

  revalidatePath("/admin/datacenters");
  return { success: true };
}

export async function updateDataCenterAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "unauthorized" };
  }

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!id || !name) {
    return { error: "invalid" };
  }

  await prisma.dataCenter.update({
    where: { id },
    data: { name, location, description }
  });

  revalidatePath("/admin/datacenters");
  return { success: true };
}

export async function toggleDataCenterAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "unauthorized" };
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { error: "invalid" };
  }

  const dataCenter = await prisma.dataCenter.findUnique({ where: { id } });
  if (!dataCenter) {
    return { error: "not_found" };
  }

  await prisma.dataCenter.update({
    where: { id },
    data: { active: !dataCenter.active }
  });

  revalidatePath("/admin/datacenters");
  return { success: true };
}

// Checklist Category Actions (Admin only)
export async function createChecklistCategoryAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "unauthorized" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const dataCenterId = String(formData.get("dataCenterId") ?? "").trim();

  if (!name || !dataCenterId) {
    return { error: "invalid" };
  }

  const maxOrder = await prisma.checklistCategory.findFirst({
    where: { dataCenterId, active: true },
    orderBy: { displayOrder: "desc" }
  });

  await prisma.checklistCategory.create({
    data: {
      name,
      dataCenterId,
      displayOrder: (maxOrder?.displayOrder ?? 0) + 1
    }
  });

  revalidatePath("/admin/checklist");
  return { success: true };
}

export async function updateChecklistCategoryAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "unauthorized" };
  }

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!id || !name) {
    return { error: "invalid" };
  }

  await prisma.checklistCategory.update({
    where: { id },
    data: { name }
  });

  revalidatePath("/admin/checklist");
  return { success: true };
}

export async function toggleChecklistCategoryAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "unauthorized" };
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { error: "invalid" };
  }

  const category = await prisma.checklistCategory.findUnique({ where: { id } });
  if (!category) {
    return { error: "not_found" };
  }

  await prisma.checklistCategory.update({
    where: { id },
    data: { active: !category.active }
  });

  revalidatePath("/admin/checklist");
  return { success: true };
}

// Checklist Item Actions (Admin only)
export async function createChecklistItemAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "unauthorized" };
  }

  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const requiresTemperature = formData.get("requiresTemperature") === "true";
  const requiresHumidity = formData.get("requiresHumidity") === "true";
  const estimatedDurationMin = Math.max(1, parseInt(String(formData.get("estimatedDurationMin") ?? "5")) || 5);

  if (!categoryId || !name) {
    return { error: "invalid" };
  }

  const maxOrder = await prisma.checklistItem.findFirst({
    where: { categoryId, active: true },
    orderBy: { displayOrder: "desc" }
  });

  await prisma.checklistItem.create({
    data: {
      categoryId,
      name,
      requiresTemperature,
      requiresHumidity,
      estimatedDurationMin,
      displayOrder: (maxOrder?.displayOrder ?? 0) + 1
    }
  });

  revalidatePath("/admin/checklist");
  return { success: true };
}

export async function updateChecklistItemAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "unauthorized" };
  }

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const requiresTemperature = formData.get("requiresTemperature") === "true";
  const requiresHumidity = formData.get("requiresHumidity") === "true";
  const estimatedDurationMin = Math.max(1, parseInt(String(formData.get("estimatedDurationMin") ?? "5")) || 5);

  if (!id || !name) {
    return { error: "invalid" };
  }

  await prisma.checklistItem.update({
    where: { id },
    data: { name, requiresTemperature, requiresHumidity, estimatedDurationMin }
  });

  revalidatePath("/admin/checklist");
  return { success: true };
}

export async function toggleChecklistItemAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "unauthorized" };
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { error: "invalid" };
  }

  const item = await prisma.checklistItem.findUnique({ where: { id } });
  if (!item) {
    return { error: "not_found" };
  }

  await prisma.checklistItem.update({
    where: { id },
    data: { active: !item.active }
  });

  revalidatePath("/admin/checklist");
  return { success: true };
}

// Daily Inspection Actions
export async function createDailyInspectionAction(formData: FormData) {
  const user = await requireUser();

  const dataCenterId = String(formData.get("dataCenterId") ?? "").trim();
  const inspectionDate = String(formData.get("inspectionDate") ?? "").trim();
  const inspectorName = user.displayName;
  const inspectionShift = parseInspectionShift(formData.get("inspectionShift")) ?? "OFFICE_HOURS";
  const returnTo = safeLocalPath(formData.get("returnTo"), "/checklist/inspection");

  const rawSlots = formData.getAll("timeSlots");
  const selectedSlots: InspectionTimeSlot[] = rawSlots
    .map((v) => parseTimeSlot(v))
    .filter((s): s is InspectionTimeSlot => s !== null);
  const primaryTimeSlot = selectedSlots[0] ?? defaultTimeSlotForShift(inspectionShift);
  const durationMinutesRaw = Number(formData.get("durationMinutes") ?? 15);
  const durationMinutes = Number.isFinite(durationMinutesRaw) && [5, 10, 15, 30, 45, 60].includes(durationMinutesRaw)
    ? durationMinutesRaw
    : 15;

  if (!dataCenterId || !inspectionDate || !inspectorName || !primaryTimeSlot) {
    return { ok: false, code: "INVALID_INPUT", message: "กรุณาเลือกข้อมูลให้ครบ" };
  }

  const date = new Date(inspectionDate);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, code: "INVALID_DATE", message: "วันที่ตรวจสอบไม่ถูกต้อง" };
  }

  const startHourMap: Record<InspectionTimeSlot, string> = {
    SLOT_0800_0900: "08:00",
    SLOT_0900_1000: "09:00",
    SLOT_1100_1200: "11:00",
    SLOT_1300_1400: "13:00",
    SLOT_1400_1500: "14:00",
    SLOT_1500_1600: "15:00",
    SLOT_1600_1700: "16:00",
    SLOT_1700_1800: "17:00",
    SLOT_1800_1900: "18:00",
    SLOT_1900_2000: "19:00",
    SLOT_2000_2100: "20:00",
    SLOT_2100_2200: "21:00",
    SLOT_2200_2300: "22:00",
    SLOT_2300_2400: "23:00",
    SLOT_0000_0100: "00:00",
    SLOT_0100_0200: "01:00",
    SLOT_0200_0300: "02:00",
    SLOT_0300_0400: "03:00",
    SLOT_0400_0500: "04:00",
    SLOT_0500_0600: "05:00",
    SLOT_0600_0700: "06:00",
    SLOT_0700_0800: "07:00"
  };

  const [hour, minute] = startHourMap[primaryTimeSlot].split(":").map((part) => Number(part));
  const inspectionStartedAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
  const inspectionCompletedAt = new Date(inspectionStartedAt.getTime() + durationMinutes * 60_000);
  const backdateMeta = normalSaveMeta();

  try {
    const checklistItems = await prisma.checklistItem.findMany({
      where: {
        active: true,
        category: {
          active: true,
          dataCenterId
        }
      },
      include: { category: true },
      orderBy: { category: { displayOrder: "asc" } }
    });

    const inspectionData = {
      inspectorName,
      inspectionShift,
      inspectionStartedAt,
      inspectionCompletedAt,
      ...backdateMeta,
      recordedById: user.id,
      recordedByName: user.displayName
    };

    const existingDuplicate = await prisma.dailyInspection.findFirst({
      where: {
        dataCenterId,
        inspectionDate: date,
        inspectionShift,
        timeSlot: primaryTimeSlot
      }
    });

    if (existingDuplicate) {
      return {
        ok: false,
        code: "DUPLICATE_SLOT",
        message: "ช่วงเวลานี้มีการบันทึกผลตรวจแล้ว ไม่สามารถบันทึกซ้ำได้"
      };
    }

    const inspection = await prisma.dailyInspection.create({
      data: {
        dataCenterId,
        inspectionDate: date,
        timeSlot: primaryTimeSlot,
        ...inspectionData
      }
    });

    for (const item of checklistItems) {
      const status = parseInspectionStatus(formData.get(`status_${item.id}`));
      const temperature = formData.get(`temperature_${item.id}`);
      const humidity = formData.get(`humidity_${item.id}`);
      const note = formData.get(`note_${item.id}`);

      if (status) {
        const tempValue = temperature ? parseFloat(String(temperature)) : null;
        const humidityValue = humidity ? parseFloat(String(humidity)) : null;
        await prisma.inspectionResult.upsert({
          where: {
            dailyInspectionId_checklistItemId: {
              dailyInspectionId: inspection.id,
              checklistItemId: item.id
            }
          },
          update: {
            status,
            temperature: tempValue,
            humidity: humidityValue,
            note: note ? String(note) : null
          },
          create: {
            dailyInspectionId: inspection.id,
            checklistItemId: item.id,
            status,
            temperature: tempValue,
            humidity: humidityValue,
            note: note ? String(note) : null
          }
        });
      }
    }

    const savedResults = await prisma.inspectionResult.findMany({
      where: { dailyInspectionId: inspection.id },
      include: {
        checklistItem: {
          include: { category: true }
        }
      }
    });

    await prisma.activityLog.deleteMany({
      where: { dailyInspectionId: inspection.id }
    });

    if (savedResults.length > 0) {
      await prisma.activityLog.createMany({
        data: savedResults.map((r) => ({
          dataCenterId,
          dailyInspectionId: inspection.id,
          checklistItemId: r.checklistItemId,
          categoryId: r.checklistItem.categoryId,
          activityType: r.status === "ABNORMAL" ? ("ISSUE_FOUND" as const) : ("NORMAL_CHECK" as const),
          title: r.checklistItem.name,
          categoryName: r.checklistItem.category.name,
          status: r.status,
          note: r.note ?? null,
          estimatedDurationMin: durationMinutes,
          temperature: r.temperature ?? null,
          humidity: r.humidity ?? null,
          inspectionDate: date,
          inspectionShift,
          inspectorName
        }))
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_DAILY_INSPECTION",
        entityType: "DailyInspection",
        entityId: inspection.id,
        detail: {
          dataCenterId,
          inspectionDate,
          inspectionShift,
          timeSlot: primaryTimeSlot,
          durationMinutes,
          startTime: inspectionStartedAt.toISOString(),
          endTime: inspectionCompletedAt.toISOString()
        }
      }
    });

    revalidatePath("/");
    revalidatePath("/checklist/inspection");
    revalidatePath("/checklist/history");
    revalidatePath("/activity");
    return { ok: true };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return {
        ok: false,
        code: "DUPLICATE_SLOT",
        message: "ช่วงเวลานี้มีการบันทึกผลตรวจแล้ว ไม่สามารถบันทึกซ้ำได้"
      };
    }
    console.error("Error in createDailyInspectionAction:", error);
    return { ok: false, code: "SAVE_FAILED", message: "บันทึกผลตรวจไม่สำเร็จ" };
  }
}

export async function resetDailyInspectionAction(formData: FormData) {
  const user = await requireUser();
  if (!canEditRole(user.role)) {
    return { ok: false, error: "unauthorized" };
  }

  const dataCenterId = String(formData.get("dataCenterId") ?? "").trim();
  const inspectionDate = String(formData.get("inspectionDate") ?? "").trim();

  if (!dataCenterId || !inspectionDate) {
    return { ok: false, error: "invalid" };
  }

  const inspections = await prisma.dailyInspection.findMany({
    where: {
      dataCenterId,
      inspectionDate: new Date(inspectionDate)
    },
    select: { id: true }
  });

  if (inspections.length === 0) {
    revalidatePath("/checklist/inspection");
    revalidatePath("/checklist/history");
    revalidatePath("/");
    return { ok: true, deleted: false };
  }

  const inspectionIds = inspections.map((i) => i.id);
  await prisma.$transaction([
    prisma.activityLog.deleteMany({
      where: { dailyInspectionId: { in: inspectionIds } }
    }),
    prisma.inspectionResult.deleteMany({
      where: { dailyInspectionId: { in: inspectionIds } }
    }),
    prisma.dailyInspection.deleteMany({
      where: { id: { in: inspectionIds } }
    })
  ]);

  const inspection = inspections[0];

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "RESET_DAILY_INSPECTION",
      entityType: "DailyInspection",
      entityId: inspection.id,
      detail: { dataCenterId, inspectionDate }
    }
  });

  revalidatePath("/checklist/inspection");
  revalidatePath("/checklist/history");
  revalidatePath("/");
  return { ok: true, deleted: true };
}

function parseInspectionStatus(value: FormDataEntryValue | null): InspectionStatus | null {
  const status = String(value ?? "").toUpperCase();
  return status === "NORMAL" || status === "ABNORMAL" ? status as InspectionStatus : null;
}

export async function updateSystemSettingAction(formData: FormData) {
  await requireUser(["ADMIN"]);
  const returnTo = safeLocalPath(formData.get("returnTo"), "/admin/settings/basic");

  const allowedKeys = ["workload_min_vm", "workload_min_server", "workload_min_network"];
  const updates: { key: string; value: string }[] = [];

  for (const key of allowedKeys) {
    const raw = formData.get(key);
    if (raw === null) continue;
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0 || n > 999) redirect(appendLocalParam(returnTo, "error", "invalid"));
    updates.push({ key, value: String(Math.round(n)) });
  }

  if (updates.length === 0) redirect(returnTo);

  await prisma.$transaction(
    updates.map(({ key, value }) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      })
    )
  );

  revalidatePath("/admin/settings/basic");
  revalidatePath("/activity");
  redirect(appendLocalParam(returnTo, "saved", "1"));
}

// === Server Metric Entry (Daily Shared Recording) ===

function computeMetricStatus(percent: number): "NORMAL" | "WARNING" | "CRITICAL" {
  if (percent >= 90) return "CRITICAL";
  if (percent >= 80) return "WARNING";
  return "NORMAL";
}

function worstStatus(...statuses: ("NORMAL" | "WARNING" | "CRITICAL")[]): "NORMAL" | "WARNING" | "CRITICAL" {
  if (statuses.includes("CRITICAL")) return "CRITICAL";
  if (statuses.includes("WARNING")) return "WARNING";
  return "NORMAL";
}

export async function bulkUpsertServerMetricAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeLocalPath(formData.get("returnTo"), "/servers/metrics");
  if (!canEditRole(user.role)) redirect(returnTo);

  const recordDateStr = String(formData.get("recordDate") ?? "");
  const recordDate = new Date(recordDateStr);
  if (Number.isNaN(recordDate.getTime())) redirect(appendLocalParam(returnTo, "error", "date"));
  recordDate.setHours(0, 0, 0, 0);

  const rawEntries = String(formData.get("entries") ?? "");
  type MetricInput = {
    assetId: string;
    cpuPercent: number;
    ramUsedGb: number;
    ramTotalGb: number;
    note?: string;
    disks?: Array<{ diskName: string; mountPoint?: string; usedGb: number; totalGb: number }>;
  };
  let parsed: MetricInput[] = [];
  try {
    parsed = JSON.parse(rawEntries);
  } catch {
    redirect(appendLocalParam(returnTo, "error", "data"));
  }

  if (!Array.isArray(parsed) || parsed.length === 0) redirect(appendLocalParam(returnTo, "error", "empty"));

  const ops = parsed.map((entry) => {
    const ramPercent = entry.ramTotalGb > 0 ? Math.round((entry.ramUsedGb / entry.ramTotalGb) * 10000) / 100 : 0;
    const cpuStatus = computeMetricStatus(entry.cpuPercent);
    const ramStatus = computeMetricStatus(ramPercent);

    const diskStatuses: ("NORMAL" | "WARNING" | "CRITICAL")[] = [];
    const diskOps = (entry.disks ?? []).map((d) => {
      const pct = d.totalGb > 0 ? Math.round((d.usedGb / d.totalGb) * 10000) / 100 : 0;
      const st = computeMetricStatus(pct);
      diskStatuses.push(st);
      return { diskName: d.diskName, mountPoint: d.mountPoint ?? null, usedGb: d.usedGb, totalGb: d.totalGb, percent: pct, status: st };
    });

    const overallStatus = worstStatus(cpuStatus, ramStatus, ...diskStatuses);

    return {
      assetId: entry.assetId,
      cpuPercent: entry.cpuPercent,
      ramUsedGb: entry.ramUsedGb,
      ramTotalGb: entry.ramTotalGb,
      ramPercent,
      cpuStatus,
      ramStatus,
      overallStatus,
      note: entry.note?.trim() || null,
      disks: diskOps
    };
  });

  await prisma.$transaction(
    ops.map((op) =>
      prisma.serverMetricEntry.upsert({
        where: { assetId_recordDate: { assetId: op.assetId, recordDate } },
        create: {
          assetId: op.assetId,
          recordDate,
          cpuPercent: op.cpuPercent,
          ramUsedGb: op.ramUsedGb,
          ramTotalGb: op.ramTotalGb,
          ramPercent: op.ramPercent,
          cpuStatus: op.cpuStatus,
          ramStatus: op.ramStatus,
          overallStatus: op.overallStatus,
          note: op.note,
          recordedById: user.id,
          updatedById: user.id,
          disks: op.disks.length > 0 ? { create: op.disks } : undefined
        },
        update: {
          cpuPercent: op.cpuPercent,
          ramUsedGb: op.ramUsedGb,
          ramTotalGb: op.ramTotalGb,
          ramPercent: op.ramPercent,
          cpuStatus: op.cpuStatus,
          ramStatus: op.ramStatus,
          overallStatus: op.overallStatus,
          note: op.note,
          updatedById: user.id
        }
      })
    )
  );

  // For upserted entries with disks, handle disk details separately for updates
  for (const op of ops) {
    if (op.disks.length > 0) {
      const existing = await prisma.serverMetricEntry.findUnique({
        where: { assetId_recordDate: { assetId: op.assetId, recordDate } },
        select: { id: true }
      });
      if (existing) {
        await prisma.serverDiskDetail.deleteMany({ where: { metricEntryId: existing.id } });
        await prisma.serverDiskDetail.createMany({
          data: op.disks.map((d) => ({ metricEntryId: existing.id, ...d }))
        });
      }
    }
  }

  revalidatePath("/servers/metrics");
  revalidatePath("/servers");
  revalidatePath("/");
  redirect(appendLocalParam(returnTo, "saved", "1"));
}

function parseInspectionShift(value: FormDataEntryValue | null): InspectionShift | null {
  const shift = String(value ?? "").toUpperCase();
  return shift === "OFFICE_HOURS" || shift === "MORNING_SHIFT" || shift === "AFTERNOON_SHIFT" || shift === "NIGHT_SHIFT"
    ? shift as InspectionShift
    : null;
}

function parseTimeSlot(value: FormDataEntryValue): InspectionTimeSlot | null {
  const slot = String(value ?? "").toUpperCase();
  const valid: InspectionTimeSlot[] = [
    "SLOT_0800_0900", "SLOT_0900_1000", "SLOT_1100_1200", "SLOT_1300_1400",
    "SLOT_1400_1500", "SLOT_1500_1600", "SLOT_1600_1700", "SLOT_1700_1800",
    "SLOT_1800_1900", "SLOT_1900_2000", "SLOT_2000_2100", "SLOT_2100_2200",
    "SLOT_2200_2300", "SLOT_2300_2400", "SLOT_0000_0100", "SLOT_0100_0200",
    "SLOT_0200_0300", "SLOT_0300_0400", "SLOT_0400_0500", "SLOT_0500_0600",
    "SLOT_0600_0700", "SLOT_0700_0800"
  ];
  return valid.includes(slot as InspectionTimeSlot) ? slot as InspectionTimeSlot : null;
}
