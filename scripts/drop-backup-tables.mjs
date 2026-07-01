import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS `BackupInspectionItemResult`");
  await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS `BackupInspectionLog`");
  console.log("Tables dropped OK");
} catch (e) {
  console.error("Error:", e.message);
} finally {
  await prisma.$disconnect();
}
