-- CreateTable
CREATE TABLE `InspectionPolicy` (
    `id` VARCHAR(191) NOT NULL,
    `categoryKey` VARCHAR(191) NOT NULL,
    `categoryLabel` VARCHAR(191) NOT NULL,
    `minRoundsPerDay` INTEGER NOT NULL DEFAULT 1,
    `requiredShifts` VARCHAR(191) NOT NULL DEFAULT 'ALL',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `note` TEXT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InspectionPolicy_categoryKey_key`(`categoryKey`),
    INDEX `InspectionPolicy_active_idx`(`active`),
    INDEX `InspectionPolicy_displayOrder_idx`(`displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default policies (runs once via migration, INSERT IGNORE skips if already exists)
INSERT IGNORE INTO `InspectionPolicy` (`id`, `categoryKey`, `categoryLabel`, `minRoundsPerDay`, `requiredShifts`, `active`, `displayOrder`, `updatedAt`)
VALUES
  ('policy_vm',      'VM',      'VM Host',          6, 'ALL',                           1, 1, NOW()),
  ('policy_server',  'SERVER',  'Host Server',       6, 'ALL',                           1, 2, NOW()),
  ('policy_network', 'NETWORK', 'Network Device',    6, 'ALL',                           1, 3, NOW()),
  ('policy_backup',  'BACKUP',  'Backup / Database', 6, 'ALL',                           1, 4, NOW()),
  ('policy_dcroom',  'DC_ROOM', 'Data Center Room',  2, 'MORNING_SHIFT,AFTERNOON_SHIFT', 1, 5, NOW());
