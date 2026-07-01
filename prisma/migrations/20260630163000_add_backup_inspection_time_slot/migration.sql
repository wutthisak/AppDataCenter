ALTER TABLE `BackupInspectionLog`
  ADD COLUMN `timeSlot` VARCHAR(191) NULL,
  ADD COLUMN `inspectionStartedAt` DATETIME(3) NULL,
  ADD COLUMN `inspectionCompletedAt` DATETIME(3) NULL;

CREATE INDEX `BackupInspectionLog_timeSlot_inspectionDate_idx`
  ON `BackupInspectionLog`(`timeSlot`, `inspectionDate`);
