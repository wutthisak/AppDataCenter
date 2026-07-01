-- CreateTable BackupJobItem
CREATE TABLE `BackupJobItem` (
    `id`          VARCHAR(191) NOT NULL,
    `backupJobId` VARCHAR(191) NOT NULL,
    `itemType`    VARCHAR(191) NOT NULL,
    `sourceType`  VARCHAR(191) NOT NULL,
    `sourceId`    VARCHAR(191) NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `remark`      TEXT         NULL,
    `active`      BOOLEAN      NOT NULL DEFAULT true,
    `displayOrder` INTEGER     NOT NULL DEFAULT 0,
    `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3)  NOT NULL,

    INDEX `BackupJobItem_backupJobId_idx`(`backupJobId`),
    INDEX `BackupJobItem_sourceType_sourceId_idx`(`sourceType`, `sourceId`),
    INDEX `BackupJobItem_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BackupJobItem` ADD CONSTRAINT `BackupJobItem_backupJobId_fkey`
  FOREIGN KEY (`backupJobId`) REFERENCES `BackupJob`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
