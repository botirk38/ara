import { db } from "./index";
import {
  customers,
  invoices,
  timelineEvents,
  specterEnrichments,
} from "./schema";
import { v4 as uuid } from "uuid";

const now = new Date().toISOString();

const seedCustomers = [
  {
    id: "cust-001",
    name: "Northwind Studios",
    email: "accounts@northwindstudios.co.uk",
    phone: "+447700900001",
    whatsapp: null,
    relationship: "good",
    avgDaysLate: 15,
    createdAt: now,
  },
  {
    id: "cust-002",
    name: "Apex Legal Ltd",
    email: "finance@apexlegal.co.uk",
    phone: "+447700900002",
    whatsapp: null,
    relationship: "risky",
    avgDaysLate: 45,
    createdAt: now,
  },
  {
    id: "cust-003",
    name: "Bluefin Retail",
    email: "pay@bluefinretail.co.uk",
    phone: "+447700900003",
    whatsapp: null,
    relationship: "good",
    avgDaysLate: 5,
    createdAt: now,
  },
  {
    id: "cust-004",
    name: "Camden Studio",
    email: "hello@camdenstudio.co.uk",
    phone: "+447700900004",
    whatsapp: null,
    relationship: "good",
    avgDaysLate: 3,
    createdAt: now,
  },
  {
    id: "cust-005",
    name: "Albion Foods",
    email: "accounts@albionfoods.co.uk",
    phone: "+447700900005",
    whatsapp: null,
    relationship: "neutral",
    avgDaysLate: 25,
    createdAt: now,
  },
];

const seedInvoices = [
  {
    id: "inv-001",
    customerId: "cust-001",
    invoiceNumber: "INV-1023",
    amount: 4200,
    currency: "GBP",
    dueDate: "2026-03-28",
    daysOverdue: 32,
    status: "overdue",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "inv-002",
    customerId: "cust-002",
    invoiceNumber: "INV-1024",
    amount: 18400,
    currency: "GBP",
    dueDate: "2026-01-26",
    daysOverdue: 94,
    status: "overdue",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "inv-003",
    customerId: "cust-003",
    invoiceNumber: "INV-1025",
    amount: 2100,
    currency: "GBP",
    dueDate: "2026-04-18",
    daysOverdue: 12,
    status: "overdue",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "inv-004",
    customerId: "cust-004",
    invoiceNumber: "INV-1026",
    amount: 950,
    currency: "GBP",
    dueDate: "2026-04-25",
    daysOverdue: 5,
    status: "overdue",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "inv-005",
    customerId: "cust-005",
    invoiceNumber: "INV-1027",
    amount: 5050,
    currency: "GBP",
    dueDate: "2026-03-13",
    daysOverdue: 48,
    status: "overdue",
    createdAt: now,
    updatedAt: now,
  },
];

const seedSpecter = [
  {
    id: uuid(),
    customerId: "cust-001",
    companyName: "Northwind Studios",
    riskSignal: "low",
    revenueSignal: "Growing — 15% YoY revenue increase",
    newsSignal: "No negative signals",
    raw: JSON.stringify({
      status: "active",
      sector: "creative_services",
      risk: "low",
    }),
    createdAt: now,
  },
  {
    id: uuid(),
    customerId: "cust-002",
    companyName: "Apex Legal Ltd",
    riskSignal: "high",
    revenueSignal: "Declining — recent redundancies reported",
    newsSignal: "Negative — regulatory investigation pending",
    raw: JSON.stringify({
      status: "active",
      sector: "legal",
      risk: "high",
    }),
    createdAt: now,
  },
  {
    id: uuid(),
    customerId: "cust-003",
    companyName: "Bluefin Retail",
    riskSignal: "low",
    revenueSignal: "Stable",
    newsSignal: "No negative signals",
    raw: JSON.stringify({ status: "active", sector: "retail", risk: "low" }),
    createdAt: now,
  },
  {
    id: uuid(),
    customerId: "cust-004",
    companyName: "Camden Studio",
    riskSignal: "low",
    revenueSignal: "Stable — small creative studio",
    newsSignal: "No negative signals",
    raw: JSON.stringify({
      status: "active",
      sector: "creative_services",
      risk: "low",
    }),
    createdAt: now,
  },
  {
    id: uuid(),
    customerId: "cust-005",
    companyName: "Albion Foods",
    riskSignal: "medium",
    revenueSignal: "Flat — sector under margin pressure",
    newsSignal: "Mixed — supply chain disruption in sector",
    raw: JSON.stringify({
      status: "active",
      sector: "food_wholesale",
      risk: "medium",
    }),
    createdAt: now,
  },
];

let seedPromise: Promise<void> | null = null;

async function doSeed() {
  const existingCustomers = await db.select().from(customers);
  if (existingCustomers.length > 0) {
    return;
  }

  console.log("Seeding database...");

  await db.insert(customers).values(seedCustomers).onConflictDoNothing();
  await db.insert(invoices).values(seedInvoices).onConflictDoNothing();
  await db.insert(specterEnrichments).values(seedSpecter).onConflictDoNothing();

  const timelineValues = seedInvoices.map((inv) => ({
    id: uuid(),
    invoiceId: inv.id,
    actor: "System",
    message: `Invoice ${inv.invoiceNumber} imported from Briefcase`,
    eventType: "info",
    createdAt: now,
  }));
  await db.insert(timelineEvents).values(timelineValues).onConflictDoNothing();

  console.log("Seed complete: 5 customers, 5 invoices, 5 Specter enrichments");
}

export function seed() {
  if (!seedPromise) {
    seedPromise = doSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

// Run when executed directly as a script (e.g., bun run db:seed)
if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  new URL(import.meta.url).pathname === new URL(`file://${process.argv[1]}`).pathname
) {
  seed().catch(console.error);
}
