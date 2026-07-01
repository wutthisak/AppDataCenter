-- AlterTable: add durationMinutes, inspectionStartedAt, inspectionCompletedAt to DailyStatusEntry
ALTER TABLE `DailyStatusEntry`
  ADD COLUMN `durationMinutes` INT NULL,
  ADD COLUMN `inspectionStartedAt` DATETIME(3) NULL,
  ADD COLUMN `inspectionCompletedAt` DATETIME(3) NULL;
