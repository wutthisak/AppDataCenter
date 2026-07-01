import { AssetCategoryCode, PrismaClient, Role, AssetOptionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertCategory(code: AssetCategoryCode, name: string, displayOrder: number) {
  return prisma.assetCategory.upsert({
    where: { code },
    update: { name, displayOrder },
    create: { code, name, displayOrder }
  });
}

async function upsertAssetOption(type: AssetOptionType, value: string, displayOrder: number) {
  await prisma.assetOption.upsert({
    where: {
      type_value: {
        type,
        value
      }
    },
    update: { displayOrder },
    create: { type, value, displayOrder }
  });
}

async function upsertInspectionPolicy(
  categoryKey: string,
  categoryLabel: string,
  minRoundsPerDay: number,
  requiredShifts: string,
  displayOrder: number
) {
  await prisma.inspectionPolicy.upsert({
    where: { categoryKey },
    update: { categoryLabel, minRoundsPerDay, requiredShifts, active: true, displayOrder },
    create: { categoryKey, categoryLabel, minRoundsPerDay, requiredShifts, active: true, displayOrder }
  });
}

async function seedNetworkDeviceTypes() {
  const networkCategory = await prisma.assetCategory.findUnique({ where: { code: "NETWORK" } });
  if (!networkCategory) return;

  await prisma.asset.updateMany({
    where: {
      categoryId: networkCategory.id,
      deviceType: null,
      name: { startsWith: "CoreNetwork" }
    },
    data: { deviceType: "Switch" }
  });

  await prisma.asset.updateMany({
    where: {
      categoryId: networkCategory.id,
      deviceType: null,
      name: { startsWith: "WLC" }
    },
    data: { deviceType: "Access point" }
  });

  await prisma.asset.updateMany({
    where: {
      categoryId: networkCategory.id,
      deviceType: null,
      name: { startsWith: "Link Internet" }
    },
    data: { deviceType: "Router" }
  });
}

async function repairFutureInstalledDates() {
  const threshold = new Date();
  threshold.setFullYear(threshold.getFullYear() + 100);

  const assets = await prisma.asset.findMany({
    where: { installedAt: { gt: threshold } },
    select: { id: true, installedAt: true }
  });

  for (const asset of assets) {
    if (!asset.installedAt) continue;
    const repaired = new Date(asset.installedAt);
    repaired.setUTCFullYear(repaired.getUTCFullYear() - 543);
    await prisma.asset.update({
      where: { id: asset.id },
      data: { installedAt: repaired }
    });
  }
}

async function removeGeneratedBackupInspectionAssets() {
  const generatedAssets = await prisma.asset.findMany({
    where: {
      category: { code: "BACKUP" },
      OR: [
        { displayOrder: { gte: 100000 } },
        { code: { startsWith: "BACKUP_JOB:" } },
        { code: { startsWith: "BACKUP_JOB_ITEM:" } }
      ]
    },
    select: { id: true }
  });

  const assetIds = generatedAssets.map((asset) => asset.id);
  if (assetIds.length === 0) return;

  await prisma.dailyStatusEntry.deleteMany({ where: { assetId: { in: assetIds } } });
  await prisma.serverMetricLog.deleteMany({ where: { serverAssetId: { in: assetIds } } });
  await prisma.serverDiskDetail.deleteMany({ where: { metricEntry: { assetId: { in: assetIds } } } });
  await prisma.serverMetricEntry.deleteMany({ where: { assetId: { in: assetIds } } });
  await prisma.asset.deleteMany({ where: { id: { in: assetIds } } });
}

type ChecklistSeedCategory = {
  name: string;
  items: Array<{
    name: string;
    requiresTemperature: boolean;
    requiresHumidity?: boolean;
  }>;
};

async function seedChecklist(dataCenterId: string, categories: ChecklistSeedCategory[]) {
  for (const [categoryIndex, categorySeed] of categories.entries()) {
    const displayOrder = categoryIndex + 1;
    const existingCategory = await prisma.checklistCategory.findFirst({
      where: { dataCenterId, displayOrder }
    });

    const category = existingCategory
      ? await prisma.checklistCategory.update({
          where: { id: existingCategory.id },
          data: {
            name: categorySeed.name,
            active: true
          }
        })
      : await prisma.checklistCategory.create({
          data: {
            name: categorySeed.name,
            dataCenterId,
            displayOrder,
            active: true
          }
        });

    for (const [itemIndex, itemSeed] of categorySeed.items.entries()) {
      const itemDisplayOrder = itemIndex + 1;
      const existingItem = await prisma.checklistItem.findFirst({
        where: {
          categoryId: category.id,
          displayOrder: itemDisplayOrder
        }
      });

      const data = {
        name: itemSeed.name,
        requiresTemperature: itemSeed.requiresTemperature,
        requiresHumidity: itemSeed.requiresHumidity ?? false,
        active: true
      };

      if (existingItem) {
        await prisma.checklistItem.update({
          where: { id: existingItem.id },
          data
        });
      } else {
        await prisma.checklistItem.create({
          data: {
            ...data,
            categoryId: category.id,
            displayOrder: itemDisplayOrder
          }
        });
      }
    }
  }
}

async function main() {
  const adminPassword = await bcrypt.hash("admin1234", 12);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      displayName: "System Administrator",
      passwordHash: adminPassword,
      role: Role.ADMIN
    }
  });

  await upsertCategory("VM", "Virtual Machines", 1);
  await upsertCategory("SERVER", "Physical / Host Servers", 2);
  await upsertCategory("NETWORK", "Network Systems", 3);
  await upsertCategory("STORAGE", "Storage Devices", 4);
  await upsertCategory("BACKUP", "Database Backup", 5);
  await upsertInspectionPolicy("VM", "VM Host", 6, "ALL", 1);
  await upsertInspectionPolicy("SERVER", "Host Server", 6, "ALL", 2);
  await upsertInspectionPolicy("NETWORK", "Network Device", 6, "ALL", 3);
  await upsertInspectionPolicy("STORAGE", "Storage Device", 6, "ALL", 4);
  await upsertInspectionPolicy("BACKUP", "Backup / Database", 6, "ALL", 5);
  await upsertInspectionPolicy("DC_ROOM", "Data Center Room", 2, "MORNING_SHIFT,AFTERNOON_SHIFT", 6);
  await removeGeneratedBackupInspectionAssets();

  const databaseTypes = ["MySQL", "SQL Server", "PostgreSQL", "Oracle", "MariaDB", "MongoDB", "Redis"];
  const osTypes = ["Windows", "Ubuntu", "Rocky", "CentOS", "Red Hat", "Debian"];
  const deviceTypes = ["Switch", "Access point", "Router", "Firewall"];
  const storageDeviceTypes = ["SAN", "NAS", "External USB"];
  const ownershipTypes = ["เช่า", "ซื้อ"];

  for (const [index, value] of databaseTypes.entries()) {
    await upsertAssetOption(AssetOptionType.DATABASE_TYPE, value, index + 1);
  }

  for (const [index, value] of osTypes.entries()) {
    await upsertAssetOption(AssetOptionType.OS_TYPE, value, index + 1);
  }

  for (const [index, value] of deviceTypes.entries()) {
    await upsertAssetOption(AssetOptionType.DEVICE_TYPE, value, index + 1);
  }

  for (const [index, value] of storageDeviceTypes.entries()) {
    await upsertAssetOption(AssetOptionType.STORAGE_DEVICE_TYPE, value, index + 1);
  }

  for (const [index, value] of ownershipTypes.entries()) {
    await upsertAssetOption(AssetOptionType.ASSET_OWNERSHIP_TYPE, value, index + 1);
  }

  await seedNetworkDeviceTypes();
  await repairFutureInstalledDates();

  // Seed Data Centers
  const dc1 = await prisma.dataCenter.upsert({
    where: { id: "dc-1" },
    update: {},
    create: {
      id: "dc-1",
      name: "Data Center 1",
      location: "อาคาร A ชั้น 2",
      description: "ห้อง Data Center 1 - มีแอร์ 4 ตัว",
      displayOrder: 1,
      active: true
    }
  });

  const dc2 = await prisma.dataCenter.upsert({
    where: { id: "dc-2" },
    update: {},
    create: {
      id: "dc-2",
      name: "Data Center 2",
      location: "อาคาร B ชั้น 1",
      description: "ห้อง Data Center 2 - มีแอร์ 2 ตัว",
      displayOrder: 2,
      active: true
    }
  });

  // Seed Checklist Categories and Items for Data Center 1
  const dc1Categories = [
    {
      name: "ระบบทำความเย็น",
      items: [
        { name: "อุณหภูมิห้อง", requiresTemperature: true },
        { name: "แอร์ตัวที่ 1", requiresTemperature: false },
        { name: "แอร์ตัวที่ 2", requiresTemperature: false },
        { name: "แอร์ตัวที่ 3", requiresTemperature: false },
        { name: "แอร์ตัวที่ 4", requiresTemperature: false }
      ]
    },
    {
      name: "ระบบควบคุมการเข้าออก",
      items: [
        { name: "Finger Scan - สถานะไฟ", requiresTemperature: false }
      ]
    },
    {
      name: "ระบบบันทึกภาพการเข้า-ออก",
      items: [
        { name: "NVR - สามารถดูได้", requiresTemperature: false }
      ]
    },
    {
      name: "อุปกรณ์ป้องกันเครือข่าย",
      items: [
        { name: "Firewall - ทำงานปกติ", requiresTemperature: false }
      ]
    },
    {
      name: "อุปกรณ์กระจายสัญญาณหลัก",
      items: [
        { name: "Core Switch - ทำงานปกติ", requiresTemperature: false }
      ]
    }
  ];

  await seedChecklist(dc1.id, dc1Categories);

  // Seed Checklist Categories and Items for Data Center 2
  const dc2Categories = [
    {
      name: "ระบบทำความเย็น",
      items: [
        { name: "อุณหภูมิห้อง", requiresTemperature: true },
        { name: "แอร์ตัวที่ 1", requiresTemperature: false },
        { name: "แอร์ตัวที่ 2", requiresTemperature: false }
      ]
    },
    {
      name: "ระบบควบคุมการเข้าออก",
      items: [
        { name: "Finger Scan - สถานะไฟ", requiresTemperature: false }
      ]
    },
    {
      name: "ระบบบันทึกภาพการเข้า-ออก",
      items: [
        { name: "NVR - สามารถดูได้", requiresTemperature: false }
      ]
    },
    {
      name: "อุปกรณ์ป้องกันเครือข่าย",
      items: [
        { name: "Firewall - ทำงานปกติ", requiresTemperature: false }
      ]
    },
    {
      name: "อุปกรณ์กระจายสัญญาณหลัก",
      items: [
        { name: "Core Switch - ทำงานปกติ", requiresTemperature: false }
      ]
    }
  ];

  await seedChecklist(dc2.id, dc2Categories);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
