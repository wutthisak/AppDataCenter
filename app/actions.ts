"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { AssetCategoryCode, AssetOptionType, Role, InspectionStatus, InspectionShift, InspectionTimeSlot } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canEditRole, canReviewRole, createSession, destroySession, requireUser } from "@/lib/auth";
import { createTotpSecret, verifyTotp } from "@/lib/totp";
import { validateDay, validateStatusCode } from "@/lib/report";
import { parseAssetCapacityGb } from "@/lib/assets";

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

function parseAssetOptionType(value: FormDataEntryValue | null): AssetOptionType | null {
  const type = String(value ?? "");
  return type === "DATABASE_TYPE" || type === "OS_TYPE" || type === "NETWORK_BRAND" || type === "BUILDING" ? type as AssetOptionType : null;
}

function revalidateAssetOptionPaths(returnTo: string) {
  revalidatePath("/admin/settings/basic");
  revalidatePath("/admin/assets/vm");
  revalidatePath("/admin/assets/host");
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

  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, include: { category: true } });
  if (!report || !asset || report.status === "LOCKED") redirect(returnTo);
  if (!validateDay(report.month, report.buddhistYear, day)) redirect(returnTo);
  if (!validateStatusCode(asset.category.code, statusCode)) redirect(returnTo);

  await prisma.dailyStatusEntry.upsert({
    where: { reportId_assetId_day: { reportId, assetId, day } },
    update: { statusCode, timeSlot, note, updatedById: user.id },
    create: { reportId, assetId, day, timeSlot, statusCode, note, recordedById: user.id, updatedById: user.id }
  });

  revalidatePath(`/reports/${reportId}`);
  revalidateLocalPath(returnTo);
  redirect(appendRefreshParam(returnTo));
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

  if (!["VM", "SERVER", "NETWORK", "BACKUP"].includes(categoryCode)) redirect(returnTo);
  if (!applyAllActive && assetIds.length === 0) redirect(returnTo);

  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report || report.status === "LOCKED") redirect(returnTo);
  if (!validateDay(report.month, report.buddhistYear, day)) redirect(returnTo);
  if (!validateStatusCode(categoryCode, statusCode)) redirect(returnTo);

  const uniqueAssetIds = Array.from(new Set(assetIds));
  const assets = await prisma.asset.findMany({
    where: applyAllActive
      ? { active: true, category: { code: categoryCode } }
      : {
          id: { in: uniqueAssetIds },
          active: true,
          category: { code: categoryCode }
        },
    select: { id: true }
  });
  if (!applyAllActive && assets.length !== uniqueAssetIds.length) redirect(returnTo);
  if (assets.length === 0) redirect(returnTo);

  const timeSlot = slots[0] ?? ("SLOT_0800_0900" as InspectionTimeSlot);
  await prisma.$transaction(
    assets.map((asset) => prisma.dailyStatusEntry.upsert({
      where: { reportId_assetId_day: { reportId, assetId: asset.id, day } },
      update: { statusCode, timeSlot, note: null, updatedById: user.id },
      create: { reportId, assetId: asset.id, day, timeSlot, statusCode, note: null, recordedById: user.id, updatedById: user.id }
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

  if (!["VM", "SERVER", "NETWORK", "BACKUP"].includes(categoryCode)) return { ok: false, error: "invalid_category" };

  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report || report.status === "LOCKED") return { ok: false, error: "invalid_report" };
  if (startDay > endDay) return { ok: false, error: "invalid_range" };
  if (!validateStatusCode(categoryCode, statusCode)) return { ok: false, error: "invalid_status" };
  if (!validateDay(report.month, report.buddhistYear, startDay) || !validateDay(report.month, report.buddhistYear, endDay)) {
    return { ok: false, error: "invalid_day" };
  }

  const assets = await prisma.asset.findMany({
    where: { active: true, category: { code: categoryCode } },
    select: { id: true }
  });
  if (assets.length === 0) return { ok: false, error: "no_assets" };

  const days = Array.from({ length: endDay - startDay + 1 }, (_, index) => startDay + index);
  const timeSlot = slots[0] ?? ("SLOT_0800_0900" as InspectionTimeSlot);
  await prisma.$transaction(
    days.flatMap((day) =>
      assets.map((asset) => prisma.dailyStatusEntry.upsert({
        where: { reportId_assetId_day: { reportId, assetId: asset.id, day } },
        update: { statusCode, timeSlot, note: null, updatedById: user.id },
        create: { reportId, assetId: asset.id, day, timeSlot, statusCode, note: null, recordedById: user.id, updatedById: user.id }
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

  if (!["VM", "SERVER", "NETWORK", "BACKUP"].includes(categoryCode)) redirect(returnTo);

  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report || report.status === "LOCKED") redirect(returnTo);
  if (!validateDay(report.month, report.buddhistYear, day)) redirect(returnTo);

  const assets = await prisma.asset.findMany({ where: { category: { code: categoryCode } }, select: { id: true } });
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
  return value ? new Date(`${value}T00:00:00`) : null;
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
  const textKeys = ["model", "brand", "os", "assetNumber", "ipAddress", "location", "building", "floor", "databaseType", "databaseServer"] as const;
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
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "OPERATOR") as Role;

  if (!username || !displayName || password.length < 8) redirect("/admin/users?error=invalid");
  if (!["ADMIN", "OPERATOR"].includes(role)) redirect("/admin/users?error=invalid");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, displayName, passwordHash, role }
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "CREATE_USER",
      entityType: "User",
      entityId: user.id,
      detail: { username, role }
    }
  });

  revalidatePath("/admin/users");
}

export async function toggleUserAction(formData: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const userId = String(formData.get("userId"));
  const active = formData.get("active") === "true";

  if (admin.id === userId && !active) redirect("/admin/users?error=self");

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
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeLocalPath(formData.get("returnTo"), "/profile");

  const displayName = String(formData.get("displayName") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim() || null;
  const department = String(formData.get("department") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const defaultShift = String(formData.get("defaultShift") ?? "").trim() || null;

  if (!displayName) redirect(`${returnTo}?error=invalid`);

  await prisma.user.update({
    where: { id: user.id },
    data: { displayName, position, department, email, phone, defaultShift }
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
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const returnTo = safeLocalPath(formData.get("returnTo"), "/profile");

  if (!currentPassword || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
    redirect(`${returnTo}?error=invalid`);
  }

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record || !(await bcrypt.compare(currentPassword, record.passwordHash))) {
    redirect(`${returnTo}?error=wrong`);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CHANGE_PASSWORD",
      entityType: "User",
      entityId: user.id
    }
  });

  redirect(`${returnTo}?updated=1`);
}

export async function createTwoFactorSetupAction() {
  const user = await requireUser();
  const setup = createTotpSecret(user.username);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorSecret: setup.secret,
      twoFactorEnabled: false
    }
  });

  redirect("/security?setup=1");
}

export async function verifyTwoFactorAction(formData: FormData) {
  const user = await requireUser();
  const token = String(formData.get("token") ?? "");
  const record = await prisma.user.findUnique({ where: { id: user.id } });

  if (!record?.twoFactorSecret || !verifyTotp(token, record.twoFactorSecret)) {
    redirect("/security?error=totp&setup=1");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true }
  });

  redirect("/security?enabled=1");
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

  // Parse selected time slots (multi-select checkboxes)
  const rawSlots = formData.getAll("timeSlots");
  const selectedSlots: InspectionTimeSlot[] = rawSlots
    .map((v) => parseTimeSlot(v))
    .filter((s): s is InspectionTimeSlot => s !== null);

  if (!dataCenterId || !inspectionDate || !inspectorName) {
    redirect(appendLocalParam(returnTo, "error", "invalid"));
  }

  if (selectedSlots.length === 0) {
    redirect(appendLocalParam(returnTo, "error", "timeSlot"));
  }

  const slotsToProcess: InspectionTimeSlot[] = selectedSlots;

  const date = new Date(inspectionDate);

  try {
    // Process checklist items once (results shared across all slots)
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

    const itemCount = checklistItems.length;
    const slotCount = slotsToProcess.length;
    // Workload per item: (60 min × slots) ÷ total items, rounded to nearest int
    const workloadPerItem = itemCount > 0 ? Math.round((60 * slotCount) / itemCount) : 5;

    // Process each selected time slot
    for (const timeSlot of slotsToProcess) {
      const inspection = await prisma.dailyInspection.upsert({
        where: {
          dataCenterId_inspectionDate_timeSlot: {
            dataCenterId,
            inspectionDate: date,
            timeSlot
          }
        },
        update: {
          inspectorName,
          inspectionShift
        },
        create: {
          dataCenterId,
          inspectionDate: date,
          inspectorName,
          inspectionShift,
          timeSlot
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

      // Auto-generate ActivityLog for this slot
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
            estimatedDurationMin: workloadPerItem,
            temperature: r.temperature ?? null,
            humidity: r.humidity ?? null,
            inspectionDate: date,
            inspectionShift,
            inspectorName
          }))
        });
      }
    }

    revalidatePath("/checklist/inspection");
    revalidatePath("/checklist/history");
    revalidatePath("/activity");
    redirect(appendLocalParam(returnTo, "saved", "1"));
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error && String(error.digest).startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error("Error in createDailyInspectionAction:", error);
    throw error;
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
  const valid = ["SLOT_0800_0900", "SLOT_0900_1000", "SLOT_1100_1200", "SLOT_1300_1400", "SLOT_1400_1500", "SLOT_1500_1600"];
  return valid.includes(slot) ? slot as InspectionTimeSlot : null;
}
