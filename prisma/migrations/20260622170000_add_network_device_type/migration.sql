-- Add a managed device type option for Network Device assets.
ALTER TABLE `Asset`
  ADD COLUMN `deviceType` VARCHAR(191) NULL AFTER `name`;

ALTER TABLE `AssetOption`
  MODIFY `type` ENUM('DATABASE_TYPE','OS_TYPE','NETWORK_BRAND','DEVICE_TYPE','BUILDING') NOT NULL;
