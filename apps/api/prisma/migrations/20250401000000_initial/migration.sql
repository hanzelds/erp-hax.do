-- ============================================================
-- ERP HAX V1 — Migración inicial
-- HAX ESTUDIO CREATIVO EIRL | RNC: 133290251
-- PostgreSQL 16
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ACCOUNTANT');
CREATE TYPE "BusinessUnit" AS ENUM ('HAX', 'KODER');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT','SENDING','APPROVED','REJECTED','PAID','CANCELLED');
CREATE TYPE "InvoiceType" AS ENUM ('CREDITO_FISCAL','CONSUMO','NOTA_DEBITO','NOTA_CREDITO');
CREATE TYPE "PaymentMethod" AS ENUM ('TRANSFER','CASH','CHECK');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING','PARTIAL','PAID');
CREATE TYPE "ExpenseStatus" AS ENUM ('ACTIVE','CANCELLED');
CREATE TYPE "ExpenseCategory" AS ENUM ('OPERATIONS','MARKETING','TECHNOLOGY','RENT','UTILITIES','SALARIES','TAXES','OTHER');
CREATE TYPE "AccountType" AS ENUM ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE');
CREATE TYPE "JournalEntryType" AS ENUM ('INVOICE','PAYMENT','EXPENSE','PAYROLL','ADJUSTMENT','CREDIT_NOTE');
CREATE TYPE "BankTransactionStatus" AS ENUM ('UNMATCHED','MATCHED','IGNORED');
CREATE TYPE "LeadStatus" AS ENUM ('LEAD','CONTACT','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST');
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED','CONVERTED');
CREATE TYPE "EmployeeType" AS ENUM ('SALARIED','CONTRACTOR');
CREATE TYPE "PayrollStatus" AS ENUM ('CALCULATED','APPROVED','PAID');
CREATE TYPE "AuditAction" AS ENUM ('CREATE','UPDATE','DELETE','APPROVE','REJECT','CANCEL','SEND','PAY','CLOSE');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE "FiscalReportType" AS ENUM ('REPORT_606','REPORT_607');

-- ── users ────────────────────────────────────────────────────

CREATE TABLE "users" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "email"     TEXT         NOT NULL,
    "password"  TEXT         NOT NULL,
    "role"      "UserRole"   NOT NULL DEFAULT 'ACCOUNTANT',
    "isActive"  BOOLEAN      NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key"        ON "users"("email");
CREATE        INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- ── clients ──────────────────────────────────────────────────

CREATE TABLE "clients" (
    "id"           TEXT         NOT NULL,
    "name"         TEXT         NOT NULL,
    "businessName" TEXT,
    "rnc"          TEXT,
    "cedula"       TEXT,
    "email"        TEXT,
    "phone"        TEXT,
    "address"      TEXT,
    "city"         TEXT,
    "notes"        TEXT,
    "isActive"     BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clients_rnc_key"    ON "clients"("rnc")    WHERE "rnc" IS NOT NULL;
CREATE UNIQUE INDEX "clients_cedula_key" ON "clients"("cedula") WHERE "cedula" IS NOT NULL;
CREATE        INDEX "clients_name_idx"     ON "clients"("name");
CREATE        INDEX "clients_isActive_idx" ON "clients"("isActive");

-- ── crm_opportunities ────────────────────────────────────────

CREATE TABLE "crm_opportunities" (
    "id"           TEXT             NOT NULL,
    "clientId"     TEXT             NOT NULL,
    "businessUnit" "BusinessUnit"   NOT NULL,
    "title"        TEXT             NOT NULL,
    "description"  TEXT,
    "value"        DOUBLE PRECISION,
    "status"       "LeadStatus"     NOT NULL DEFAULT 'LEAD',
    "probability"  INTEGER          NOT NULL DEFAULT 0,
    "expectedDate" TIMESTAMP(3),
    "closedAt"     TIMESTAMP(3),
    "closedReason" TEXT,
    "assignedTo"   TEXT,
    "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_opp_clientId_idx"     ON "crm_opportunities"("clientId");
CREATE INDEX "crm_opp_status_idx"       ON "crm_opportunities"("status");
CREATE INDEX "crm_opp_businessUnit_idx" ON "crm_opportunities"("businessUnit");

-- ── quotes ───────────────────────────────────────────────────

CREATE TABLE "quotes" (
    "id"                 TEXT             NOT NULL,
    "number"             TEXT             NOT NULL,
    "clientId"           TEXT             NOT NULL,
    "opportunityId"      TEXT,
    "businessUnit"       "BusinessUnit"   NOT NULL,
    "status"             "QuoteStatus"    NOT NULL DEFAULT 'DRAFT',
    "validUntil"         TIMESTAMP(3),
    "notes"              TEXT,
    "terms"              TEXT,
    "subtotal"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total"              DOUBLE PRECISION NOT NULL DEFAULT 0,
    "convertedInvoiceId" TEXT,
    "convertedAt"        TIMESTAMP(3),
    "sentAt"             TIMESTAMP(3),
    "acceptedAt"         TIMESTAMP(3),
    "rejectedAt"         TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quotes_number_key"             ON "quotes"("number");
CREATE UNIQUE INDEX "quotes_convertedInvoiceId_key" ON "quotes"("convertedInvoiceId") WHERE "convertedInvoiceId" IS NOT NULL;
CREATE        INDEX "quotes_clientId_idx"            ON "quotes"("clientId");
CREATE        INDEX "quotes_status_idx"              ON "quotes"("status");
CREATE        INDEX "quotes_businessUnit_idx"        ON "quotes"("businessUnit");

-- ── quote_items ──────────────────────────────────────────────

CREATE TABLE "quote_items" (
    "id"          TEXT             NOT NULL,
    "quoteId"     TEXT             NOT NULL,
    "description" TEXT             NOT NULL,
    "quantity"    DOUBLE PRECISION NOT NULL,
    "unitPrice"   DOUBLE PRECISION NOT NULL,
    "taxRate"     DOUBLE PRECISION NOT NULL DEFAULT 0.18,
    "taxAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal"    DOUBLE PRECISION NOT NULL,
    "total"       DOUBLE PRECISION NOT NULL,
    "isExempt"    BOOLEAN          NOT NULL DEFAULT false,
    "sortOrder"   INTEGER          NOT NULL DEFAULT 0,
    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quote_items_quoteId_idx" ON "quote_items"("quoteId");

-- ── invoices ─────────────────────────────────────────────────

CREATE TABLE "invoices" (
    "id"                TEXT             NOT NULL,
    "number"            TEXT             NOT NULL,
    "clientId"          TEXT             NOT NULL,
    "businessUnit"      "BusinessUnit"   NOT NULL,
    "type"              "InvoiceType"    NOT NULL DEFAULT 'CREDITO_FISCAL',
    "status"            "InvoiceStatus"  NOT NULL DEFAULT 'DRAFT',
    "paymentStatus"     "PaymentStatus"  NOT NULL DEFAULT 'PENDING',
    "issueDate"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate"           TIMESTAMP(3),
    "approvedAt"        TIMESTAMP(3),
    "rejectedAt"        TIMESTAMP(3),
    "paidAt"            TIMESTAMP(3),
    "cancelledAt"       TIMESTAMP(3),
    "subtotal"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountPaid"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountDue"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes"             TEXT,
    "ncf"               TEXT,
    "xml"               TEXT,
    "alanubeId"         TEXT,
    "alanubeStatus"     TEXT,
    "rejectionReason"   TEXT,
    "originalInvoiceId" TEXT,
    "fromQuoteId"       TEXT,
    "createdAt"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoices_number_key"      ON "invoices"("number");
CREATE UNIQUE INDEX "invoices_fromQuoteId_key" ON "invoices"("fromQuoteId") WHERE "fromQuoteId" IS NOT NULL;
CREATE        INDEX "invoices_clientId_idx"      ON "invoices"("clientId");
CREATE        INDEX "invoices_status_idx"         ON "invoices"("status");
CREATE        INDEX "invoices_paymentStatus_idx"  ON "invoices"("paymentStatus");
CREATE        INDEX "invoices_businessUnit_idx"   ON "invoices"("businessUnit");
CREATE        INDEX "invoices_ncf_idx"            ON "invoices"("ncf") WHERE "ncf" IS NOT NULL;
CREATE        INDEX "invoices_issueDate_idx"      ON "invoices"("issueDate");
CREATE        INDEX "invoices_dueDate_idx"        ON "invoices"("dueDate") WHERE "dueDate" IS NOT NULL;

-- ── invoice_items ────────────────────────────────────────────

CREATE TABLE "invoice_items" (
    "id"          TEXT             NOT NULL,
    "invoiceId"   TEXT             NOT NULL,
    "description" TEXT             NOT NULL,
    "quantity"    DOUBLE PRECISION NOT NULL,
    "unitPrice"   DOUBLE PRECISION NOT NULL,
    "taxRate"     DOUBLE PRECISION NOT NULL DEFAULT 0.18,
    "taxAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal"    DOUBLE PRECISION NOT NULL,
    "total"       DOUBLE PRECISION NOT NULL,
    "isExempt"    BOOLEAN          NOT NULL DEFAULT false,
    "sortOrder"   INTEGER          NOT NULL DEFAULT 0,
    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- ── alanube_requests ─────────────────────────────────────────

CREATE TABLE "alanube_requests" (
    "id"              TEXT         NOT NULL,
    "invoiceId"       TEXT         NOT NULL,
    "attempt"         INTEGER      NOT NULL DEFAULT 1,
    "requestPayload"  JSONB        NOT NULL,
    "sentAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"          TEXT,
    "responsePayload" JSONB,
    "ncf"             TEXT,
    "xml"             TEXT,
    "errorCode"       TEXT,
    "errorMessage"    TEXT,
    "receivedAt"      TIMESTAMP(3),
    CONSTRAINT "alanube_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alanube_requests_invoiceId_idx" ON "alanube_requests"("invoiceId");
CREATE INDEX "alanube_requests_status_idx"    ON "alanube_requests"("status") WHERE "status" IS NOT NULL;

-- ── payments ─────────────────────────────────────────────────

CREATE TABLE "payments" (
    "id"         TEXT             NOT NULL,
    "invoiceId"  TEXT             NOT NULL,
    "amount"     DOUBLE PRECISION NOT NULL,
    "method"     "PaymentMethod"  NOT NULL DEFAULT 'TRANSFER',
    "reference"  TEXT,
    "notes"      TEXT,
    "paidAt"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isReversed" BOOLEAN          NOT NULL DEFAULT false,
    "reversedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");
CREATE INDEX "payments_paidAt_idx"    ON "payments"("paidAt");

-- ── bank_transactions ────────────────────────────────────────

CREATE TABLE "bank_transactions" (
    "id"              TEXT                    NOT NULL,
    "amount"          DOUBLE PRECISION        NOT NULL,
    "description"     TEXT                    NOT NULL,
    "reference"       TEXT,
    "transactionDate" TIMESTAMP(3)            NOT NULL,
    "status"          "BankTransactionStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedAt"       TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_tx_status_idx"          ON "bank_transactions"("status");
CREATE INDEX "bank_tx_transactionDate_idx" ON "bank_transactions"("transactionDate");

-- ── payments <-> bank_transactions (M:N) ────────────────────

CREATE TABLE "_PaymentBankTx" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_PaymentBankTx_AB_unique" ON "_PaymentBankTx"("A","B");
CREATE        INDEX "_PaymentBankTx_B_index"   ON "_PaymentBankTx"("B");

-- ── expenses ─────────────────────────────────────────────────

CREATE TABLE "expenses" (
    "id"           TEXT              NOT NULL,
    "businessUnit" "BusinessUnit"    NOT NULL,
    "supplier"     TEXT              NOT NULL,
    "description"  TEXT              NOT NULL,
    "amount"       DOUBLE PRECISION  NOT NULL,
    "taxAmount"    DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "total"        DOUBLE PRECISION  NOT NULL,
    "category"     "ExpenseCategory" NOT NULL DEFAULT 'OPERATIONS',
    "ncf"          TEXT,
    "receiptUrl"   TEXT,
    "status"       "ExpenseStatus"   NOT NULL DEFAULT 'ACTIVE',
    "expenseDate"  TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"    TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expenses_businessUnit_idx" ON "expenses"("businessUnit");
CREATE INDEX "expenses_category_idx"     ON "expenses"("category");
CREATE INDEX "expenses_expenseDate_idx"  ON "expenses"("expenseDate");
CREATE INDEX "expenses_status_idx"       ON "expenses"("status");

-- ── accounts ─────────────────────────────────────────────────

CREATE TABLE "accounts" (
    "id"          TEXT          NOT NULL,
    "code"        TEXT          NOT NULL,
    "name"        TEXT          NOT NULL,
    "type"        "AccountType" NOT NULL,
    "parentId"    TEXT,
    "isActive"    BOOLEAN       NOT NULL DEFAULT true,
    "allowsEntry" BOOLEAN       NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounts_code_key"   ON "accounts"("code");
CREATE        INDEX "accounts_type_idx"     ON "accounts"("type");
CREATE        INDEX "accounts_parentId_idx" ON "accounts"("parentId") WHERE "parentId" IS NOT NULL;

-- ── journal_entries ──────────────────────────────────────────

CREATE TABLE "journal_entries" (
    "id"              TEXT               NOT NULL,
    "type"            "JournalEntryType" NOT NULL,
    "businessUnit"    "BusinessUnit"     NOT NULL,
    "description"     TEXT               NOT NULL,
    "debitAccountId"  TEXT               NOT NULL,
    "creditAccountId" TEXT               NOT NULL,
    "amount"          DOUBLE PRECISION   NOT NULL,
    "period"          TEXT               NOT NULL,
    "entryDate"       TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isReversed"      BOOLEAN            NOT NULL DEFAULT false,
    "reversedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId"       TEXT,
    "paymentId"       TEXT,
    "expenseId"       TEXT,
    "payrollId"       TEXT,
    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "je_businessUnit_idx" ON "journal_entries"("businessUnit");
CREATE INDEX "je_period_idx"       ON "journal_entries"("period");
CREATE INDEX "je_type_idx"         ON "journal_entries"("type");
CREATE INDEX "je_entryDate_idx"    ON "journal_entries"("entryDate");
CREATE INDEX "je_invoiceId_idx"    ON "journal_entries"("invoiceId") WHERE "invoiceId" IS NOT NULL;
CREATE INDEX "je_paymentId_idx"    ON "journal_entries"("paymentId") WHERE "paymentId" IS NOT NULL;
CREATE INDEX "je_expenseId_idx"    ON "journal_entries"("expenseId") WHERE "expenseId" IS NOT NULL;

-- ── employees ────────────────────────────────────────────────

CREATE TABLE "employees" (
    "id"           TEXT             NOT NULL,
    "name"         TEXT             NOT NULL,
    "email"        TEXT             NOT NULL,
    "phone"        TEXT,
    "cedula"       TEXT,
    "type"         "EmployeeType"   NOT NULL DEFAULT 'SALARIED',
    "businessUnit" "BusinessUnit"   NOT NULL,
    "position"     TEXT,
    "baseSalary"   DOUBLE PRECISION NOT NULL,
    "isActive"     BOOLEAN          NOT NULL DEFAULT true,
    "hiredAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminatedAt" TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employees_email_key"       ON "employees"("email");
CREATE UNIQUE INDEX "employees_cedula_key"      ON "employees"("cedula") WHERE "cedula" IS NOT NULL;
CREATE        INDEX "employees_businessUnit_idx" ON "employees"("businessUnit");
CREATE        INDEX "employees_type_isActive_idx" ON "employees"("type","isActive");

-- ── payrolls ─────────────────────────────────────────────────

CREATE TABLE "payrolls" (
    "id"                   TEXT             NOT NULL,
    "businessUnit"         "BusinessUnit"   NOT NULL,
    "period"               TEXT             NOT NULL,
    "status"               "PayrollStatus"  NOT NULL DEFAULT 'CALCULATED',
    "totalGross"           DOUBLE PRECISION NOT NULL,
    "totalAfpEmployee"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAfpEmployer"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSfsEmployee"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSfsEmployer"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalIsr"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalOtherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNet"             DOUBLE PRECISION NOT NULL,
    "totalEmployerCost"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approvedAt"           TIMESTAMP(3),
    "paidAt"               TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payrolls_businessUnit_period_key" ON "payrolls"("businessUnit","period");
CREATE        INDEX "payrolls_status_idx" ON "payrolls"("status");
CREATE        INDEX "payrolls_period_idx" ON "payrolls"("period");

-- ── payroll_items ────────────────────────────────────────────

CREATE TABLE "payroll_items" (
    "id"               TEXT             NOT NULL,
    "payrollId"        TEXT             NOT NULL,
    "employeeId"       TEXT             NOT NULL,
    "grossSalary"      DOUBLE PRECISION NOT NULL,
    "afpEmployee"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sfsEmployee"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isr"              DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeductions"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary"        DOUBLE PRECISION NOT NULL,
    "afpEmployer"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sfsEmployer"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sfsRiesgoLaboral" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emailSent"        BOOLEAN          NOT NULL DEFAULT false,
    "emailSentAt"      TIMESTAMP(3),
    CONSTRAINT "payroll_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_items_payrollId_employeeId_key" ON "payroll_items"("payrollId","employeeId");
CREATE        INDEX "payroll_items_payrollId_idx"            ON "payroll_items"("payrollId");

-- ── fiscal_reports ───────────────────────────────────────────

CREATE TABLE "fiscal_reports" (
    "id"           TEXT               NOT NULL,
    "type"         "FiscalReportType" NOT NULL,
    "period"       TEXT               NOT NULL,
    "businessUnit" "BusinessUnit"     NOT NULL,
    "recordCount"  INTEGER            NOT NULL DEFAULT 0,
    "totalAmount"  DOUBLE PRECISION   NOT NULL DEFAULT 0,
    "totalItbis"   DOUBLE PRECISION   NOT NULL DEFAULT 0,
    "generatedAt"  TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileUrl"      TEXT,
    CONSTRAINT "fiscal_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_reports_type_period_bu_key"
    ON "fiscal_reports"("type","period","businessUnit");
CREATE INDEX "fiscal_reports_period_idx" ON "fiscal_reports"("period");

-- ── audit_logs ───────────────────────────────────────────────

CREATE TABLE "audit_logs" (
    "id"        TEXT          NOT NULL,
    "userId"    TEXT          NOT NULL,
    "action"    "AuditAction" NOT NULL,
    "entity"    TEXT          NOT NULL,
    "entityId"  TEXT          NOT NULL,
    "before"    JSONB,
    "after"     JSONB,
    "ip"        TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_userId_idx"          ON "audit_logs"("userId");
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity","entityId");
CREATE INDEX "audit_logs_action_idx"          ON "audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx"       ON "audit_logs"("createdAt");

-- ── approval_requests ────────────────────────────────────────

CREATE TABLE "approval_requests" (
    "id"              TEXT             NOT NULL,
    "entity"          TEXT             NOT NULL,
    "entityId"        TEXT             NOT NULL,
    "changeRequested" JSONB            NOT NULL,
    "reason"          TEXT,
    "status"          "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById"   TEXT             NOT NULL,
    "approvedById"    TEXT,
    "adminNotes"      TEXT,
    "resolvedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approval_req_entity_entityId_idx" ON "approval_requests"("entity","entityId");
CREATE INDEX "approval_req_status_idx"          ON "approval_requests"("status");

-- ── fiscal_periods ───────────────────────────────────────────

CREATE TABLE "fiscal_periods" (
    "id"        TEXT         NOT NULL,
    "period"    TEXT         NOT NULL,
    "isClosed"  BOOLEAN      NOT NULL DEFAULT false,
    "closedAt"  TIMESTAMP(3),
    "closedBy"  TEXT,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_periods_period_key"   ON "fiscal_periods"("period");
CREATE        INDEX "fiscal_periods_isClosed_idx" ON "fiscal_periods"("isClosed");

-- ── system_settings ──────────────────────────────────────────

CREATE TABLE "system_settings" (
    "id"        TEXT         NOT NULL,
    "key"       TEXT         NOT NULL,
    "value"     TEXT         NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

ALTER TABLE "crm_opportunities"
    ADD CONSTRAINT "crm_opp_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quotes"
    ADD CONSTRAINT "quotes_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes"
    ADD CONSTRAINT "quotes_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quote_items"
    ADD CONSTRAINT "quote_items_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_originalInvoiceId_fkey"
    FOREIGN KEY ("originalInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoice_items"
    ADD CONSTRAINT "invoice_items_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alanube_requests"
    ADD CONSTRAINT "alanube_requests_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "_PaymentBankTx"
    ADD CONSTRAINT "_PaymentBankTx_A_fkey"
    FOREIGN KEY ("A") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PaymentBankTx"
    ADD CONSTRAINT "_PaymentBankTx_B_fkey"
    FOREIGN KEY ("B") REFERENCES "bank_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entries"
    ADD CONSTRAINT "je_debitAccountId_fkey"
    FOREIGN KEY ("debitAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_entries"
    ADD CONSTRAINT "je_creditAccountId_fkey"
    FOREIGN KEY ("creditAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_entries"
    ADD CONSTRAINT "je_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journal_entries"
    ADD CONSTRAINT "je_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journal_entries"
    ADD CONSTRAINT "je_expenseId_fkey"
    FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journal_entries"
    ADD CONSTRAINT "je_payrollId_fkey"
    FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_items"
    ADD CONSTRAINT "payroll_items_payrollId_fkey"
    FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_items"
    ADD CONSTRAINT "payroll_items_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_requests"
    ADD CONSTRAINT "approval_req_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_requests"
    ADD CONSTRAINT "approval_req_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- SEED — Plan de cuentas + configuración inicial
-- ============================================================

INSERT INTO "accounts" ("id","code","name","type","allowsEntry","createdAt") VALUES
-- ACTIVOS
('acc_1000','1000','Activos',               'ASSET',false, NOW()),
('acc_1100','1100','Activos Corrientes',    'ASSET',false, NOW()),
('acc_1101','1101','Caja',                  'ASSET',true,  NOW()),
('acc_1102','1102','Banco',                 'ASSET',true,  NOW()),
('acc_1103','1103','Cuentas por Cobrar',    'ASSET',true,  NOW()),
('acc_1104','1104','ITBIS por Cobrar',      'ASSET',true,  NOW()),
('acc_1200','1200','Activos No Corrientes', 'ASSET',false, NOW()),
('acc_1201','1201','Equipos y Mobiliario',  'ASSET',true,  NOW()),
-- PASIVOS
('acc_2000','2000','Pasivos',               'LIABILITY',false, NOW()),
('acc_2100','2100','Pasivos Corrientes',    'LIABILITY',false, NOW()),
('acc_2101','2101','Cuentas por Pagar',     'LIABILITY',true,  NOW()),
('acc_2102','2102','Cuentas por Pagar Empleados','LIABILITY',true, NOW()),
('acc_2103','2103','ITBIS por Pagar',       'LIABILITY',true,  NOW()),
('acc_2104','2104','TSS por Pagar',         'LIABILITY',true,  NOW()),
('acc_2105','2105','ISR por Pagar',         'LIABILITY',true,  NOW()),
-- PATRIMONIO
('acc_3000','3000','Patrimonio',            'EQUITY',false, NOW()),
('acc_3001','3001','Capital Social',        'EQUITY',true,  NOW()),
('acc_3002','3002','Utilidades Retenidas',  'EQUITY',true,  NOW()),
-- INGRESOS
('acc_4000','4000','Ingresos',              'INCOME',false, NOW()),
('acc_4001','4001','Ingresos Servicios Hax',   'INCOME',true, NOW()),
('acc_4002','4002','Ingresos Servicios Koder', 'INCOME',true, NOW()),
('acc_4003','4003','Otros Ingresos',        'INCOME',true,  NOW()),
-- GASTOS
('acc_5000','5000','Gastos',                'EXPENSE',false, NOW()),
('acc_5001','5001','Gastos Operativos',     'EXPENSE',true,  NOW()),
('acc_5002','5002','Gastos de Marketing',   'EXPENSE',true,  NOW()),
('acc_5003','5003','Gastos de Nómina',      'EXPENSE',true,  NOW()),
('acc_5004','5004','Gastos de Tecnología',  'EXPENSE',true,  NOW()),
('acc_5005','5005','Gastos Administrativos','EXPENSE',true,  NOW())
ON CONFLICT ("code") DO NOTHING;

-- Jerarquía del plan de cuentas
UPDATE "accounts" SET "parentId"='acc_1000' WHERE "code" IN ('1100','1200');
UPDATE "accounts" SET "parentId"='acc_1100' WHERE "code" IN ('1101','1102','1103','1104');
UPDATE "accounts" SET "parentId"='acc_1200' WHERE "code" = '1201';
UPDATE "accounts" SET "parentId"='acc_2000' WHERE "code" = '2100';
UPDATE "accounts" SET "parentId"='acc_2100' WHERE "code" IN ('2101','2102','2103','2104','2105');
UPDATE "accounts" SET "parentId"='acc_3000' WHERE "code" IN ('3001','3002');
UPDATE "accounts" SET "parentId"='acc_4000' WHERE "code" IN ('4001','4002','4003');
UPDATE "accounts" SET "parentId"='acc_5000' WHERE "code" IN ('5001','5002','5003','5004','5005');

-- Período fiscal inicial
INSERT INTO "fiscal_periods" ("id","period","isClosed","createdAt")
SELECT gen_random_uuid()::text, TO_CHAR(NOW(),'YYYY-MM'), false, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "fiscal_periods" WHERE "period" = TO_CHAR(NOW(),'YYYY-MM'));

-- Configuración del sistema (tasas y datos empresa)
INSERT INTO "system_settings" ("id","key","value","updatedAt") VALUES
(gen_random_uuid()::text,'company_name',   'HAX ESTUDIO CREATIVO EIRL',NOW()),
(gen_random_uuid()::text,'company_rnc',    '133290251',                NOW()),
(gen_random_uuid()::text,'company_email',  'info@hax.com.do',          NOW()),
(gen_random_uuid()::text,'company_phone',  '8297743955',               NOW()),
(gen_random_uuid()::text,'invoice_prefix_hax',  'HAX',                 NOW()),
(gen_random_uuid()::text,'invoice_prefix_koder', 'KDR',                NOW()),
(gen_random_uuid()::text,'itbis_rate',     '0.18',                     NOW()),
(gen_random_uuid()::text,'afp_employee',   '0.0287',                   NOW()),
(gen_random_uuid()::text,'afp_employer',   '0.0710',                   NOW()),
(gen_random_uuid()::text,'sfs_employee',   '0.0304',                   NOW()),
(gen_random_uuid()::text,'sfs_employer',   '0.0709',                   NOW()),
(gen_random_uuid()::text,'riesgo_laboral', '0.0120',                   NOW()),
(gen_random_uuid()::text,'isr_exento_mensual','34685.17',               NOW())
ON CONFLICT ("key") DO NOTHING;
