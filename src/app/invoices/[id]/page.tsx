import { db } from "@/db";
import {
  invoices,
  customers,
  timelineEvents,
  autonomyDecisions,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { seed } from "@/db/seed";
import { InvoiceDetailClient } from "./client";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await seed();

  const invoice = db
    .select()
    .from(invoices)
    .where(eq(invoices.id, params.id))
    .get();

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Invoice not found</p>
      </div>
    );
  }

  const customer = db
    .select()
    .from(customers)
    .where(eq(customers.id, invoice.customerId))
    .get()!;

  const events = db
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.invoiceId, params.id))
    .orderBy(timelineEvents.createdAt)
    .all();

  const latestGate = db
    .select()
    .from(autonomyDecisions)
    .where(eq(autonomyDecisions.invoiceId, params.id))
    .orderBy(desc(autonomyDecisions.createdAt))
    .get();

  const gateResult = latestGate
    ? {
        allowed: latestGate.allowed,
        reasons: JSON.parse(latestGate.reasons) as string[],
        checks: {
          amountThresholdPassed: latestGate.amountThresholdPassed,
          disputeCheckPassed: latestGate.disputeCheckPassed,
          daysOverduePassed: latestGate.daysOverduePassed,
          specterRiskPassed: latestGate.specterRiskPassed,
          relationshipPassed: latestGate.relationshipPassed,
        },
      }
    : null;

  return (
    <InvoiceDetailClient
      invoice={{ ...invoice, customer }}
      initialEvents={events}
      initialGateResult={gateResult}
    />
  );
}
