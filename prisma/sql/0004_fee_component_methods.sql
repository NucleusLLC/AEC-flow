-- AlterTable
ALTER TABLE "service_proposal_fee_components" ADD COLUMN     "baseAmount" DECIMAL(65,30),
ADD COLUMN     "markupPercent" DECIMAL(65,30),
ADD COLUMN     "quantity" DECIMAL(65,30),
ADD COLUMN     "unitRate" DECIMAL(65,30);

