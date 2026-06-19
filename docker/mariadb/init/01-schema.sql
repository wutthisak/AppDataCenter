/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `app_data_center` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci */;

USE `app_data_center`;
DROP TABLE IF EXISTS `ActivityLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ActivityLog` (
  `id` varchar(191) NOT NULL,
  `dataCenterId` varchar(191) NOT NULL,
  `dailyInspectionId` varchar(191) NOT NULL,
  `checklistItemId` varchar(191) NOT NULL,
  `categoryId` varchar(191) NOT NULL,
  `activityType` enum('NORMAL_CHECK','ISSUE_FOUND') NOT NULL,
  `title` varchar(191) NOT NULL,
  `categoryName` varchar(191) NOT NULL,
  `status` varchar(191) NOT NULL,
  `note` text DEFAULT NULL,
  `estimatedDurationMin` int(11) NOT NULL DEFAULT 5,
  `temperature` decimal(5,2) DEFAULT NULL,
  `humidity` decimal(5,2) DEFAULT NULL,
  `inspectionDate` date NOT NULL,
  `inspectionShift` varchar(191) NOT NULL,
  `inspectorName` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `ActivityLog_dataCenterId_inspectionDate_idx` (`dataCenterId`,`inspectionDate`),
  KEY `ActivityLog_dailyInspectionId_idx` (`dailyInspectionId`),
  KEY `ActivityLog_activityType_idx` (`activityType`),
  KEY `ActivityLog_inspectionDate_idx` (`inspectionDate`),
  KEY `ActivityLog_inspectorName_inspectionDate_idx` (`inspectorName`,`inspectionDate`),
  KEY `ActivityLog_checklistItemId_fkey` (`checklistItemId`),
  KEY `ActivityLog_categoryId_fkey` (`categoryId`),
  CONSTRAINT `ActivityLog_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ChecklistCategory` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `ActivityLog_checklistItemId_fkey` FOREIGN KEY (`checklistItemId`) REFERENCES `ChecklistItem` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `ActivityLog_dailyInspectionId_fkey` FOREIGN KEY (`dailyInspectionId`) REFERENCES `DailyInspection` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ActivityLog_dataCenterId_fkey` FOREIGN KEY (`dataCenterId`) REFERENCES `DataCenter` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `Asset`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `Asset` (
  `id` varchar(191) NOT NULL,
  `categoryId` varchar(191) NOT NULL,
  `code` varchar(191) DEFAULT NULL,
  `name` varchar(191) NOT NULL,
  `model` varchar(191) DEFAULT NULL,
  `brand` varchar(191) DEFAULT NULL,
  `os` varchar(191) DEFAULT NULL,
  `cpu` varchar(191) DEFAULT NULL,
  `ram` varchar(191) DEFAULT NULL,
  `disk` varchar(191) DEFAULT NULL,
  `assetNumber` varchar(191) DEFAULT NULL,
  `ipAddress` varchar(191) DEFAULT NULL,
  `location` varchar(191) DEFAULT NULL,
  `building` varchar(191) DEFAULT NULL,
  `floor` varchar(191) DEFAULT NULL,
  `installedAt` datetime(3) DEFAULT NULL,
  `databaseType` varchar(191) DEFAULT NULL,
  `databaseServer` varchar(191) DEFAULT NULL,
  `displayOrder` int(11) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Asset_categoryId_displayOrder_key` (`categoryId`,`displayOrder`),
  KEY `Asset_categoryId_active_idx` (`categoryId`,`active`),
  KEY `Asset_active_idx` (`active`),
  KEY `Asset_categoryId_active_displayOrder_idx` (`categoryId`,`active`,`displayOrder`),
  CONSTRAINT `Asset_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `AssetCategory` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `AssetCategory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `AssetCategory` (
  `id` varchar(191) NOT NULL,
  `code` enum('VM','SERVER','NETWORK','BACKUP') NOT NULL,
  `name` varchar(191) NOT NULL,
  `displayOrder` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `AssetCategory_code_key` (`code`),
  KEY `AssetCategory_displayOrder_idx` (`displayOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `AssetOption`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `AssetOption` (
  `id` varchar(191) NOT NULL,
  `type` enum('DATABASE_TYPE','OS_TYPE','NETWORK_BRAND','BUILDING') NOT NULL,
  `value` varchar(191) NOT NULL,
  `displayOrder` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `AssetOption_type_value_key` (`type`,`value`),
  KEY `AssetOption_type_displayOrder_idx` (`type`,`displayOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `AuditLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `AuditLog` (
  `id` varchar(191) NOT NULL,
  `userId` varchar(191) DEFAULT NULL,
  `action` varchar(191) NOT NULL,
  `entityType` varchar(191) NOT NULL,
  `entityId` varchar(191) DEFAULT NULL,
  `detail` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`detail`)),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `AuditLog_userId_createdAt_idx` (`userId`,`createdAt`),
  KEY `AuditLog_entityType_entityId_idx` (`entityType`,`entityId`),
  KEY `AuditLog_action_createdAt_idx` (`action`,`createdAt`),
  KEY `AuditLog_createdAt_idx` (`createdAt`),
  CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `ChecklistCategory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ChecklistCategory` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `dataCenterId` varchar(191) NOT NULL,
  `displayOrder` int(11) NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ChecklistCategory_dataCenterId_active_idx` (`dataCenterId`,`active`),
  KEY `ChecklistCategory_dataCenterId_displayOrder_idx` (`dataCenterId`,`displayOrder`),
  CONSTRAINT `ChecklistCategory_dataCenterId_fkey` FOREIGN KEY (`dataCenterId`) REFERENCES `DataCenter` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `ChecklistItem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ChecklistItem` (
  `id` varchar(191) NOT NULL,
  `categoryId` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `requiresTemperature` tinyint(1) NOT NULL DEFAULT 0,
  `requiresHumidity` tinyint(1) NOT NULL DEFAULT 0,
  `estimatedDurationMin` int(11) NOT NULL DEFAULT 5,
  `displayOrder` int(11) NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ChecklistItem_categoryId_active_idx` (`categoryId`,`active`),
  KEY `ChecklistItem_categoryId_active_displayOrder_idx` (`categoryId`,`active`,`displayOrder`),
  CONSTRAINT `ChecklistItem_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ChecklistCategory` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `DailyInspection`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `DailyInspection` (
  `id` varchar(191) NOT NULL,
  `dataCenterId` varchar(191) NOT NULL,
  `inspectionDate` date NOT NULL,
  `inspectorName` varchar(191) NOT NULL,
  `inspectionShift` enum('OFFICE_HOURS','MORNING_SHIFT','AFTERNOON_SHIFT','NIGHT_SHIFT') NOT NULL DEFAULT 'OFFICE_HOURS',
  `timeSlot` enum('SLOT_0800_0900','SLOT_0900_1000','SLOT_1100_1200','SLOT_1300_1400','SLOT_1400_1500','SLOT_1500_1600','SLOT_1600_1700','SLOT_1700_1800','SLOT_1800_1900','SLOT_1900_2000','SLOT_2000_2100','SLOT_2100_2200','SLOT_2200_2300','SLOT_2300_2400','SLOT_0000_0100','SLOT_0100_0200','SLOT_0200_0300','SLOT_0300_0400','SLOT_0400_0500','SLOT_0500_0600','SLOT_0600_0700','SLOT_0700_0800') NOT NULL DEFAULT 'SLOT_0800_0900',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `DailyInspection_dataCenterId_inspectionDate_timeSlot_key` (`dataCenterId`,`inspectionDate`,`timeSlot`),
  KEY `DailyInspection_dataCenterId_idx` (`dataCenterId`),
  KEY `DailyInspection_inspectionDate_idx` (`inspectionDate`),
  CONSTRAINT `DailyInspection_dataCenterId_fkey` FOREIGN KEY (`dataCenterId`) REFERENCES `DataCenter` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `DailyStatusEntry`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `DailyStatusEntry` (
  `id` varchar(191) NOT NULL,
  `reportId` varchar(191) NOT NULL,
  `assetId` varchar(191) NOT NULL,
  `day` int(11) NOT NULL,
  `timeSlot` enum('SLOT_0800_0900','SLOT_0900_1000','SLOT_1100_1200','SLOT_1300_1400','SLOT_1400_1500','SLOT_1500_1600','SLOT_1600_1700','SLOT_1700_1800','SLOT_1800_1900','SLOT_1900_2000','SLOT_2000_2100','SLOT_2100_2200','SLOT_2200_2300','SLOT_2300_2400','SLOT_0000_0100','SLOT_0100_0200','SLOT_0200_0300','SLOT_0300_0400','SLOT_0400_0500','SLOT_0500_0600','SLOT_0600_0700','SLOT_0700_0800') NOT NULL DEFAULT 'SLOT_0800_0900',
  `statusCode` enum('N','H','F','D','C','R') NOT NULL,
  `note` text DEFAULT NULL,
  `recordedById` varchar(191) DEFAULT NULL,
  `updatedById` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `DailyStatusEntry_reportId_assetId_day_key` (`reportId`,`assetId`,`day`),
  KEY `DailyStatusEntry_reportId_day_idx` (`reportId`,`day`),
  KEY `DailyStatusEntry_assetId_reportId_idx` (`assetId`,`reportId`),
  KEY `DailyStatusEntry_reportId_assetId_idx` (`reportId`,`assetId`),
  KEY `DailyStatusEntry_reportId_statusCode_idx` (`reportId`,`statusCode`),
  KEY `DailyStatusEntry_updatedById_updatedAt_idx` (`updatedById`,`updatedAt`),
  KEY `DailyStatusEntry_recordedById_fkey` (`recordedById`),
  CONSTRAINT `DailyStatusEntry_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `DailyStatusEntry_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `DailyStatusEntry_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `MonthlyReport` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DailyStatusEntry_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `DataCenter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `DataCenter` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `location` varchar(191) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `displayOrder` int(11) NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `DataCenter_active_idx` (`active`),
  KEY `DataCenter_displayOrder_idx` (`displayOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `IncidentLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `IncidentLog` (
  `id` varchar(191) NOT NULL,
  `reportId` varchar(191) NOT NULL,
  `happenedAt` datetime(3) NOT NULL,
  `fiscalYear` int(11) NOT NULL,
  `description` text NOT NULL,
  `recoveryTime` varchar(191) DEFAULT NULL,
  `downtimeMinutes` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IncidentLog_reportId_idx` (`reportId`),
  KEY `IncidentLog_fiscalYear_idx` (`fiscalYear`),
  KEY `IncidentLog_happenedAt_idx` (`happenedAt`),
  CONSTRAINT `IncidentLog_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `MonthlyReport` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `InspectionResult`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `InspectionResult` (
  `id` varchar(191) NOT NULL,
  `dailyInspectionId` varchar(191) NOT NULL,
  `checklistItemId` varchar(191) NOT NULL,
  `status` enum('NORMAL','ABNORMAL') NOT NULL,
  `temperature` decimal(5,2) DEFAULT NULL,
  `humidity` decimal(5,2) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `InspectionResult_dailyInspectionId_checklistItemId_key` (`dailyInspectionId`,`checklistItemId`),
  KEY `InspectionResult_dailyInspectionId_idx` (`dailyInspectionId`),
  KEY `InspectionResult_checklistItemId_idx` (`checklistItemId`),
  KEY `InspectionResult_status_idx` (`status`),
  CONSTRAINT `InspectionResult_checklistItemId_fkey` FOREIGN KEY (`checklistItemId`) REFERENCES `ChecklistItem` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `InspectionResult_dailyInspectionId_fkey` FOREIGN KEY (`dailyInspectionId`) REFERENCES `DailyInspection` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `MonthlyReport`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `MonthlyReport` (
  `id` varchar(191) NOT NULL,
  `month` int(11) NOT NULL,
  `buddhistYear` int(11) NOT NULL,
  `status` enum('DRAFT','REVIEWED','LOCKED') NOT NULL DEFAULT 'DRAFT',
  `reviewerName` varchar(191) DEFAULT NULL,
  `reviewedById` varchar(191) DEFAULT NULL,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `lockedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `MonthlyReport_month_buddhistYear_key` (`month`,`buddhistYear`),
  KEY `MonthlyReport_buddhistYear_month_idx` (`buddhistYear`,`month`),
  KEY `MonthlyReport_updatedAt_idx` (`updatedAt`),
  KEY `MonthlyReport_status_idx` (`status`),
  KEY `MonthlyReport_reviewedById_fkey` (`reviewedById`),
  CONSTRAINT `MonthlyReport_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `ServerDiskDetail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ServerDiskDetail` (
  `id` varchar(191) NOT NULL,
  `metricEntryId` varchar(191) NOT NULL,
  `diskName` varchar(191) NOT NULL,
  `mountPoint` varchar(191) DEFAULT NULL,
  `usedGb` decimal(12,2) NOT NULL,
  `totalGb` decimal(12,2) NOT NULL,
  `percent` decimal(5,2) NOT NULL,
  `status` enum('NORMAL','WARNING','CRITICAL') NOT NULL DEFAULT 'NORMAL',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ServerDiskDetail_metricEntryId_diskName_key` (`metricEntryId`,`diskName`),
  KEY `ServerDiskDetail_metricEntryId_idx` (`metricEntryId`),
  CONSTRAINT `ServerDiskDetail_metricEntryId_fkey` FOREIGN KEY (`metricEntryId`) REFERENCES `ServerMetricEntry` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `ServerMetricEntry`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ServerMetricEntry` (
  `id` varchar(191) NOT NULL,
  `assetId` varchar(191) NOT NULL,
  `recordDate` date NOT NULL,
  `cpuPercent` decimal(5,2) NOT NULL,
  `ramUsedGb` decimal(10,2) NOT NULL,
  `ramTotalGb` decimal(10,2) NOT NULL,
  `ramPercent` decimal(5,2) NOT NULL,
  `cpuStatus` enum('NORMAL','WARNING','CRITICAL') NOT NULL DEFAULT 'NORMAL',
  `ramStatus` enum('NORMAL','WARNING','CRITICAL') NOT NULL DEFAULT 'NORMAL',
  `overallStatus` enum('NORMAL','WARNING','CRITICAL') NOT NULL DEFAULT 'NORMAL',
  `note` text DEFAULT NULL,
  `recordedShift` enum('OFFICE_HOURS','MORNING_SHIFT','AFTERNOON_SHIFT','NIGHT_SHIFT') DEFAULT NULL,
  `recordedTimeSlot` enum('SLOT_0800_0900','SLOT_0900_1000','SLOT_1100_1200','SLOT_1300_1400','SLOT_1400_1500','SLOT_1500_1600','SLOT_1600_1700','SLOT_1700_1800','SLOT_1800_1900','SLOT_1900_2000','SLOT_2000_2100','SLOT_2100_2200','SLOT_2200_2300','SLOT_2300_2400','SLOT_0000_0100','SLOT_0100_0200','SLOT_0200_0300','SLOT_0300_0400','SLOT_0400_0500','SLOT_0500_0600','SLOT_0600_0700','SLOT_0700_0800') DEFAULT NULL,
  `recordedById` varchar(191) DEFAULT NULL,
  `recordedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedById` varchar(191) DEFAULT NULL,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ServerMetricEntry_assetId_recordDate_key` (`assetId`,`recordDate`),
  KEY `ServerMetricEntry_recordDate_idx` (`recordDate`),
  KEY `ServerMetricEntry_assetId_recordDate_idx` (`assetId`,`recordDate`),
  KEY `ServerMetricEntry_overallStatus_idx` (`overallStatus`),
  KEY `ServerMetricEntry_recordedById_recordedAt_idx` (`recordedById`,`recordedAt`),
  KEY `ServerMetricEntry_updatedById_fkey` (`updatedById`),
  CONSTRAINT `ServerMetricEntry_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `ServerMetricEntry_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ServerMetricEntry_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `ServerMetricLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ServerMetricLog` (
  `id` varchar(191) NOT NULL,
  `reportId` varchar(191) NOT NULL,
  `serverAssetId` varchar(191) NOT NULL,
  `measuredAt` datetime(3) NOT NULL,
  `cpuPercent` decimal(5,2) NOT NULL,
  `ramUsedGb` decimal(10,2) NOT NULL,
  `ramTotalGb` decimal(10,2) NOT NULL,
  `diskUsedGb` decimal(12,2) NOT NULL,
  `diskTotalGb` decimal(12,2) NOT NULL,
  `note` text DEFAULT NULL,
  `createdById` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ServerMetricLog_serverAssetId_measuredAt_idx` (`serverAssetId`,`measuredAt`),
  KEY `ServerMetricLog_reportId_idx` (`reportId`),
  KEY `ServerMetricLog_reportId_measuredAt_idx` (`reportId`,`measuredAt`),
  KEY `ServerMetricLog_measuredAt_idx` (`measuredAt`),
  KEY `ServerMetricLog_createdById_createdAt_idx` (`createdById`,`createdAt`),
  CONSTRAINT `ServerMetricLog_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ServerMetricLog_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `MonthlyReport` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ServerMetricLog_serverAssetId_fkey` FOREIGN KEY (`serverAssetId`) REFERENCES `Asset` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `SystemSetting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `SystemSetting` (
  `key` varchar(191) NOT NULL,
  `value` varchar(191) NOT NULL,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `User`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `User` (
  `id` varchar(191) NOT NULL,
  `username` varchar(191) NOT NULL,
  `displayName` varchar(191) NOT NULL,
  `passwordHash` varchar(191) NOT NULL,
  `role` enum('ADMIN','OPERATOR') NOT NULL DEFAULT 'OPERATOR',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `position` varchar(191) DEFAULT NULL,
  `department` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `defaultShift` varchar(191) DEFAULT NULL,
  `twoFactorEnabled` tinyint(1) NOT NULL DEFAULT 0,
  `twoFactorSecret` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_username_key` (`username`),
  KEY `User_active_idx` (`active`),
  KEY `User_role_active_idx` (`role`,`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

