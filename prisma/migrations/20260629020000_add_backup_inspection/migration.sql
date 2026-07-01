-- Drop if partial creation occurred
DROP TABLE IF EXISTS `BackupInspectionItemResult`;
DROP TABLE IF EXISTS `BackupInspectionLog`;

-- CreateTable BackupInspectionLog
CREATE TABLE `BackupInspectionLog` (
    `id`               VARCHAR(191) NOT NULL,
    `inspectionDate`   DATE         NOT NULL,
    `inspectionShift`  VARCHAR(191) NOT NULL DEFAULT 'OFFICE_HOURS',
    `inspectorName`    VARCHAR(191) NOT NULL,
    `recordedById`     VARCHAR(191) NULL,
    `durationMinutes`  INTEGER      NOT NULL DEFAULT 15,
    `note`             TEXT         NULL,
    `createdAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`        DATETIME(3)  NOT NULL,

    INDEX `BackupInspectionLog_inspectionDate_idx`(`inspectionDate`),
    INDEX `BackupInspectionLog_inspectionShift_inspectionDate_idx`(`inspectionShift`, `inspectionDate`),
    INDEX `BackupInspectionLog_recordedById_createdAt_idx`(`recordedById`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable BackupInspectionItemResult
CREATE TABLE `BackupInspectionItemResult` (
    `id`                    VARCHAR(191) NOT NULL,
    `backupInspectionLogId` VARCHAR(191) NOT NULL,
    `backupJobId`           VARCHAR(191) NOT NULL,
    `backupJobItemId`       VARCHAR(191) NULL,
    `resultStatus`          VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `note`                  TEXT         NULL,
    `recordedById`          VARCHAR(191) NULL,
    `inspectedAt`           DATETIME(3)  NULL,
    `createdAt`             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`             DATETIME(3)  NOT NULL,

    UNIQUE INDEX `BIItemResult_logId_jobId_itemId_uq`(`backupInspectionLogId`, `backupJobId`, `backupJobItemId`),
    INDEX `BackupInspectionItemResult_backupInspectionLogId_idx`(`backupInspectionLogId`),
    INDEX `BackupInspectionItemResult_backupJobId_idx`(`backupJobId`),
    INDEX `BackupInspectionItemResult_backupJobItemId_idx`(`backupJobItemId`),
    INDEX `BackupInspectionItemResult_resultStatus_idx`(`resultStatus`),
    INDEX `BackupInspectionItemResult_inspectedAt_idx`(`inspectedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BackupInspectionItemResult` ADD CONSTRAINT `BackupInspectionItemResult_backupInspectionLogId_fkey`
  FOREIGN KEY (`backupInspectionLogId`) REFERENCES `BackupInspectionLog`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
