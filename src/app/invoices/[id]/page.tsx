import { db } from "@/db";
import {
  invoices,
  customers,
  timelineEvents,
  autonomyDecisions,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { InvoiceDetailClient } from "./client";

export const dynamic = "force-dynamic";

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!SAFE_ID.test(params.id)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Invalid invoice ID</p>
      </div>
    );
  }

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, params.id));
  const invoice = invoiceRows[0];

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Invoice not found</p>
      </div>
    );
  }

  const customerRows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, invoice.customerId));
  const customer = customerRows[0]!;

  const events = await db
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.invoiceId, params.id))
    .orderBy(timelineEvents.createdAt);

  const gateRows = await db
    .select()
    .from(autonomyDecisions)
    .where(eq(autonomyDecisions.invoiceId, params.id))
    .orderBy(desc(autonomyDecisions.createdAt));
  const latestGate = gateRows[0];

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
