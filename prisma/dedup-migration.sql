-- Step 1: Delete duplicates keeping only the latest record per (reportId, assetId, day)
DELETE d1 FROM DailyStatusEntry d1
INNER JOIN DailyStatusEntry d2
ON d1.reportId = d2.reportId
AND d1.assetId = d2.assetId
AND d1.day = d2.day
AND d1.updatedAt < d2.updatedAt;

-- Step 2: If there are still duplicates (same updatedAt), keep the one with smallest id
DELETE d1 FROM DailyStatusEntry d1
INNER JOIN DailyStatusEntry d2
ON d1.reportId = d2.reportId
AND d1.assetId = d2.assetId
AND d1.day = d2.day
AND d1.id > d2.id;

-- Step 3: Drop old unique index and create new one
ALTER TABLE DailyStatusEntry DROP INDEX DailyStatusEntry_reportId_assetId_day_timeSlot_key;
ALTER TABLE DailyStatusEntry ADD UNIQUE INDEX DailyStatusEntry_reportId_assetId_day_key (reportId, assetId, day);
