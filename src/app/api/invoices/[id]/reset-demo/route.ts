import { db } from "@/db";
import {
  invoices,
  recoveryActions,
  autonomyDecisions,
  timelineEvents,
  paymentLinks,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id));
  const invoice = invoiceRows[0];
  if (!invoice) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Delete related records
  await db
    .delete(recoveryActions)
    .where(eq(recoveryActions.invoiceId, id));
  await db
    .delete(autonomyDecisions)
    .where(eq(autonomyDecisions.invoiceId, id));
  await db
    .delete(timelineEvents)
    .where(eq(timelineEvents.invoiceId, id));
  await db
    .delete(paymentLinks)
    .where(eq(paymentLinks.invoiceId, id));

  // Reset invoice status
  await db
    .update(invoices)
    .set({ status: "overdue", updatedAt: new Date().toISOString() })
    .where(eq(invoices.id, id));

  // Re-add initial timeline event
  await db.insert(timelineEvents).values({
    id: uuid(),
    invoiceId: id,
    actor: "System",
    message: `Invoice ${invoice.invoiceNumber} imported from Briefcase`,
    eventType: "info",
    createdAt: new Date().toISOString(),
  });

  return Response.json({ success: true });
}
