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

  const invoice = db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!invoice) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Delete related records
  db.delete(recoveryActions)
    .where(eq(recoveryActions.invoiceId, id))
    .run();
  db.delete(autonomyDecisions)
    .where(eq(autonomyDecisions.invoiceId, id))
    .run();
  db.delete(timelineEvents)
    .where(eq(timelineEvents.invoiceId, id))
    .run();
  db.delete(paymentLinks)
    .where(eq(paymentLinks.invoiceId, id))
    .run();

  // Reset invoice status
  db.update(invoices)
    .set({ status: "overdue", updatedAt: new Date().toISOString() })
    .where(eq(invoices.id, id))
    .run();

  // Re-add initial timeline event
  db.insert(timelineEvents)
    .values({
      id: uuid(),
      invoiceId: id,
      actor: "System",
      message: `Invoice ${invoice.invoiceNumber} imported from Briefcase`,
      eventType: "info",
      createdAt: new Date().toISOString(),
    })
    .run();

  return Response.json({ success: true });
}
