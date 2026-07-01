-- CreateTable
CREATE TABLE `BackupJob` (
    `id`             VARCHAR(191) NOT NULL,
    `backupName`     VARCHAR(191) NOT NULL,
    `systemName`     VARCHAR(191) NOT NULL,
    `backupType`     VARCHAR(191) NOT NULL,
    `sourceServer`   VARCHAR(191) NOT NULL,
    `destination`    VARCHAR(191) NOT NULL,
    `backupSoftware` VARCHAR(191) NOT NULL,
    `schedule`       VARCHAR(191) NOT NULL,
    `requiredShift`  VARCHAR(191) NOT NULL DEFAULT 'ALL',
    `priority`       VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `active`         BOOLEAN      NOT NULL DEFAULT true,
    `remark`         TEXT         NULL,
    `displayOrder`   INTEGER      NOT NULL DEFAULT 0,
    `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`      DATETIME(3)  NOT NULL,

    INDEX `BackupJob_active_idx`(`active`),
    INDEX `BackupJob_backupType_idx`(`backupType`),
    INDEX `BackupJob_schedule_idx`(`schedule`),
    INDEX `BackupJob_displayOrder_idx`(`displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
