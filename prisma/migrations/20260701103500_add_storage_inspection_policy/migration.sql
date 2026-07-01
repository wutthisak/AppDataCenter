INSERT IGNORE INTO `InspectionPolicy`
  (`id`, `categoryKey`, `categoryLabel`, `minRoundsPerDay`, `requiredShifts`, `active`, `displayOrder`, `updatedAt`)
VALUES
  ('policy_storage', 'STORAGE', 'Storage Device', 6, 'ALL', 1, 4, NOW());

UPDATE `InspectionPolicy`
SET `displayOrder` = 5, `updatedAt` = NOW()
WHERE `categoryKey` = 'BACKUP';

UPDATE `InspectionPolicy`
SET `displayOrder` = 6, `updatedAt` = NOW()
WHERE `categoryKey` = 'DC_ROOM';
