import { db } from "@/db";
import {
  invoices,
  recoveryActions,
  autonomyDecisions,
  timelineEvents,
  paymentLinks,
  pendingApprovals,
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

  await db.transaction(async (tx) => {
    await tx
      .delete(recoveryActions)
      .where(eq(recoveryActions.invoiceId, id));
    await tx
      .delete(autonomyDecisions)
      .where(eq(autonomyDecisions.invoiceId, id));
    await tx
      .delete(timelineEvents)
      .where(eq(timelineEvents.invoiceId, id));
    await tx
      .delete(paymentLinks)
      .where(eq(paymentLinks.invoiceId, id));

    try {
      await tx
        .delete(pendingApprovals)
        .where(eq(pendingApprovals.invoiceId, id));
    } catch (err: unknown) {
      const isUndefinedTable =
        err instanceof Error &&
        "code" in err &&
        (err as { code: string }).code === "42P01";
      if (!isUndefinedTable) {
        throw err;
      }
    }

    await tx
      .update(invoices)
      .set({ status: "overdue", updatedAt: new Date().toISOString() })
      .where(eq(invoices.id, id));

    await tx.insert(timelineEvents).values({
      id: uuid(),
      invoiceId: id,
      actor: "System",
      message: `Invoice ${invoice.invoiceNumber} reset to demo state`,
      eventType: "info",
      createdAt: new Date().toISOString(),
    });
  });

  return Response.json({ success: true, invoiceId: id });
}
