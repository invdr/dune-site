-- CreateEnum
CREATE TYPE "country" AS ENUM ('RU', 'AE', 'SA');

-- CreateEnum
CREATE TYPE "property_category" AS ENUM ('RESIDENTIAL', 'COMMERCIAL');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "attributes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "category" "property_category" NOT NULL DEFAULT 'RESIDENTIAL',
ADD COLUMN     "country" "country" NOT NULL DEFAULT 'RU',
ADD COLUMN     "description" TEXT;
