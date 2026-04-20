ALTER TABLE "reconciliation_txs" ADD COLUMN IF NOT EXISTS "accountCode" TEXT;
ALTER TABLE "reconciliation_txs" ADD COLUMN IF NOT EXISTS "classifiedInvoiceId" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "categoryCode" TEXT;
