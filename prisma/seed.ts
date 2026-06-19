import { PrismaClient, Role, AssetOptionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const vmAssets = [
  "API-LABUBON", "API-Manage", "API-node1", "API-node1", "BMC", "BunkerWeb-01",
  "CardioSRV", "Control-Cluster", "Daychaserver", "DB01", "DB02", "DC1", "DC2",
  "DHC01", "DMS-API", "eSight-A", "eSight-A", "HPE_SSMC", "ILO Amplifier",
  "ImageSRV01", "intra", "Jaynlab", "Mail", "MySQL-Master1", "Nginx-Proxy01",
  "Nginx-Proxy02", "NodeJs01", "NodeJs02", "NPS01", "NPS02", "PFRadius",
  "Programmer-CNT", "Proxy-web", "R-LB01", "R-LB02", "Research_SRV", "RFIDW10",
  "saph2", "SPS-Radius01", "SQLSRV1", "SQLSRV2", "SQLSRV4", "tomcat",
  "UbonSystem", "Web-MEC", "Web-Service-OLD", "Web-SunpasitNEW", "WebMedia",
  "WebService", "WebSunpasit", "MQTT01-SRV"
];

const serverAssets = [
  "esxi-b1", "esxi-b2", "esxi-b3", "esxi-b4", "esxi-b9",
  "esxi-b10", "esxi-b11", "esxi-b12", "esxi-b13", "spsexpress"
];

const networkAssets = [
  "WLC-Huewei-SPS", "WLC-Huewei", "WLC-Cisco", "CoreNetwork-SPS",
  "CoreNetwork-SCH", "Link Internet WAN1", "Link Internet WAN2", "Link Internet WAN3"
];

const backupAssets = [
  "BackOffice", "ERP", "HBAC", "HOMC", "HOMCPICT", "INV", "Invdent",
  "LABINF", "Pharms", "Pm2014", "powerbi", "PT", "sittibat", "TMAIS"
];

async function upsertCategory(code: "VM" | "SERVER" | "NETWORK" | "BACKUP", name: string, displayOrder: number) {
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

async function seedAssets(categoryId: string, names: string[]) {
  for (const [index, name] of names.entries()) {
    await prisma.asset.upsert({
      where: {
        categoryId_displayOrder: {
          categoryId,
          displayOrder: index + 1
        }
      },
      update: { name, active: true },
      create: {
        categoryId,
        name,
        displayOrder: index + 1,
        active: true
      }
    });
  }
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

  const vm = await upsertCategory("VM", "Virtual Machines", 1);
  const server = await upsertCategory("SERVER", "Physical / Host Servers", 2);
  const network = await upsertCategory("NETWORK", "Network Systems", 3);
  const backup = await upsertCategory("BACKUP", "Database Backup", 4);

  const databaseTypes = ["MySQL", "SQL Server", "PostgreSQL", "Oracle", "MariaDB", "MongoDB", "Redis"];
  const osTypes = ["Windows", "Ubuntu", "Rocky", "CentOS", "Red Hat", "Debian"];

  for (const [index, value] of databaseTypes.entries()) {
    await upsertAssetOption(AssetOptionType.DATABASE_TYPE, value, index + 1);
  }

  for (const [index, value] of osTypes.entries()) {
    await upsertAssetOption(AssetOptionType.OS_TYPE, value, index + 1);
  }

  await seedAssets(vm.id, vmAssets);
  await seedAssets(server.id, serverAssets);
  await seedAssets(network.id, networkAssets);
  await seedAssets(backup.id, backupAssets);

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
