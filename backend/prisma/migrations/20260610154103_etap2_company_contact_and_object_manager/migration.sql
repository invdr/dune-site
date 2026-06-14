-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "manager_name" TEXT,
ADD COLUMN     "manager_phone" TEXT,
ADD COLUMN     "manager_photo_url" TEXT;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "company_contact" TEXT,
ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "company_phone" TEXT;
