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
import type { AutonomyGateResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await seed();

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

  let gateResult: AutonomyGateResult | null = null;
  if (latestGate) {
    let reasons: string[] = [];
    try {
      const parsed: unknown = JSON.parse(latestGate.reasons);
      if (Array.isArray(parsed)) {
        reasons = parsed.filter((r): r is string => typeof r === "string");
      }
    } catch {
      // malformed JSON — default to empty reasons
    }
    gateResult = {
      allowed: latestGate.allowed,
      reasons,
      checks: {
        amountThresholdPassed: latestGate.amountThresholdPassed,
        disputeCheckPassed: latestGate.disputeCheckPassed,
        daysOverduePassed: latestGate.daysOverduePassed,
        specterRiskPassed: latestGate.specterRiskPassed,
        relationshipPassed: latestGate.relationshipPassed,
      },
    };
  }

  return (
    <InvoiceDetailClient
      invoice={{ ...invoice, customer }}
      initialEvents={events}
      initialGateResult={gateResult}
    />
  );
}
