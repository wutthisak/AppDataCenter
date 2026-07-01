-- Add inspection timing and backdate metadata without changing existing records.
ALTER TABLE `DailyInspection`
  ADD COLUMN `inspectionStartedAt` DATETIME(3) NULL AFTER `timeSlot`,
  ADD COLUMN `inspectionCompletedAt` DATETIME(3) NULL AFTER `inspectionStartedAt`,
  ADD COLUMN `isBackdated` BOOLEAN NOT NULL DEFAULT false AFTER `inspectionCompletedAt`,
  ADD COLUMN `backdateReason` TEXT NULL AFTER `isBackdated`,
  ADD COLUMN `recordedById` VARCHAR(191) NULL AFTER `backdateReason`,
  ADD COLUMN `recordedByName` VARCHAR(191) NULL AFTER `recordedById`;

CREATE INDEX `DailyInspection_inspectionShift_inspectionDate_idx`
  ON `DailyInspection`(`inspectionShift`, `inspectionDate`);
CREATE INDEX `DailyInspection_isBackdated_idx`
  ON `DailyInspection`(`isBackdated`);
CREATE INDEX `DailyInspection_recordedById_createdAt_idx`
  ON `DailyInspection`(`recordedById`, `createdAt`);

ALTER TABLE `DailyStatusEntry`
  ADD COLUMN `inspectionShift` ENUM('OFFICE_HOURS','MORNING_SHIFT','AFTERNOON_SHIFT','NIGHT_SHIFT') NOT NULL DEFAULT 'OFFICE_HOURS' AFTER `timeSlot`,
  ADD COLUMN `inspectedAt` DATETIME(3) NULL AFTER `inspectionShift`,
  ADD COLUMN `isBackdated` BOOLEAN NOT NULL DEFAULT false AFTER `note`,
  ADD COLUMN `backdateReason` TEXT NULL AFTER `isBackdated`;

CREATE INDEX `DailyStatusEntry_inspectionShift_idx`
  ON `DailyStatusEntry`(`inspectionShift`);
CREATE INDEX `DailyStatusEntry_isBackdated_idx`
  ON `DailyStatusEntry`(`isBackdated`);
