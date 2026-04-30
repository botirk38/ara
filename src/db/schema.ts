import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  whatsapp: text("whatsapp"),
  relationship: text("relationship").notNull(), // good | neutral | risky
  avgDaysLate: integer("avg_days_late").default(0),
  createdAt: text("created_at").notNull(),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").default("GBP"),
  dueDate: text("due_date").notNull(),
  daysOverdue: integer("days_overdue").notNull(),
  status: text("status").notNull(),
  // overdue | recovering | promise_to_pay | paid | disputed | human_review
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const recoveryActions = sqliteTable("recovery_actions", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  channel: text("channel").notNull(),
  // phone | email | whatsapp | system
  actionType: text("action_type").notNull(),
  // call | email | whatsapp | eval | payment_link | human_review
  content: text("content"),
  status: text("status").notNull(),
  // drafted | approved | blocked | sent | called | completed
  createdAt: text("created_at").notNull(),
});

export const autonomyDecisions = sqliteTable("autonomy_decisions", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  allowed: integer("allowed", { mode: "boolean" }).notNull(),
  reasons: text("reasons").notNull(), // JSON
  amountThresholdPassed: integer("amount_threshold_passed", {
    mode: "boolean",
  }).notNull(),
  disputeCheckPassed: integer("dispute_check_passed", {
    mode: "boolean",
  }).notNull(),
  daysOverduePassed: integer("days_overdue_passed", {
    mode: "boolean",
  }).notNull(),
  specterRiskPassed: integer("specter_risk_passed", {
    mode: "boolean",
  }).notNull(),
  relationshipPassed: integer("relationship_passed", {
    mode: "boolean",
  }).notNull(),
  createdAt: text("created_at").notNull(),
});


export const timelineEvents = sqliteTable("timeline_events", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  actor: text("actor").notNull(),
  // ARRA | White Circle | Debtor | Briefcase | Specter | System
  message: text("message").notNull(),
  eventType: text("event_type").notNull(),
  // info | success | blocked | call | email | eval | risk
  createdAt: text("created_at").notNull(),
});

export const specterEnrichments = sqliteTable("specter_enrichments", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  companyName: text("company_name").notNull(),
  riskSignal: text("risk_signal").notNull(), // low | medium | high
  revenueSignal: text("revenue_signal"),
  newsSignal: text("news_signal"),
  raw: text("raw").notNull(), // JSON
  createdAt: text("created_at").notNull(),
});

export const paymentLinks = sqliteTable("payment_links", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  url: text("url").notNull(),
  status: text("status").notNull(), // generated | sent | clicked | paid
  createdAt: text("created_at").notNull(),
});
