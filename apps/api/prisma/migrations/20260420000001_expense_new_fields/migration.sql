-- Add accountCode and paymentMethod to expenses
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "accountCode" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT 'TRANSFER';
