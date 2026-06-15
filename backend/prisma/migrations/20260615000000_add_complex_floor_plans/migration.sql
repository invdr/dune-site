-- AlterTable
ALTER TABLE "complexes" ADD COLUMN     "floor_plans" TEXT[] DEFAULT ARRAY[]::TEXT[];
