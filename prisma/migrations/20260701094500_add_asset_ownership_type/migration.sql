-- Add ownership type for Host Server and Network Device assets.
ALTER TABLE `Asset`
  ADD COLUMN `ownershipType` VARCHAR(191) NULL AFTER `location`;

ALTER TABLE `AssetOption`
  MODIFY `type` ENUM('DATABASE_TYPE','OS_TYPE','NETWORK_BRAND','DEVICE_TYPE','BUILDING','ASSET_OWNERSHIP_TYPE') NOT NULL;
