-- Phase 3: Build Accounting Foundation + Party Master Migration

-- AlterEnum PartyType
ALTER TYPE "PartyType" ADD VALUE IF NOT EXISTS 'DEALER';
ALTER TYPE "PartyType" ADD VALUE IF NOT EXISTS 'DISTRIBUTOR';
ALTER TYPE "PartyType" ADD VALUE IF NOT EXISTS 'OTHER';

-- AlterEnum TransactionType
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'PURCHASE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'PURCHASE_RETURN';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SALE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SALE_RETURN';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'EXPENSE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'INCOME';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'OPENING_BALANCE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT';

-- AlterTable parties
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "mobile" TEXT;
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "alternateMobile" TEXT;
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "openingBalanceType" "BalanceType" NOT NULL DEFAULT 'DEBIT';
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT DEFAULT '30 Days';
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE INDEX IF NOT EXISTS "parties_storeId_idx" ON "parties"("storeId");

-- Foreign key for parties.storeId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parties_storeId_fkey'
  ) THEN
    ALTER TABLE "parties" ADD CONSTRAINT "parties_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable journal_entry_lines
ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "partyId" TEXT;
CREATE INDEX IF NOT EXISTS "journal_entry_lines_partyId_idx" ON "journal_entry_lines"("partyId");

-- Foreign key for journal_entry_lines.partyId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journal_entry_lines_partyId_fkey'
  ) THEN
    ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable accounting_transactions
ALTER TABLE "accounting_transactions" ADD COLUMN IF NOT EXISTS "journalEntryId" TEXT;

-- Foreign key for accounting_transactions.journalEntryId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounting_transactions_journalEntryId_fkey'
  ) THEN
    ALTER TABLE "accounting_transactions" ADD CONSTRAINT "accounting_transactions_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
