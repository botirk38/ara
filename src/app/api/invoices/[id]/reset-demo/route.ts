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

  try {
    await db
      .delete(pendingApprovals)
      .where(eq(pendingApprovals.invoiceId, id));
  } catch (err: unknown) {
    if (!isUndefinedTableError(err)) {
      console.error("[reset-demo] Failed to delete pending approvals:", err);
    }
  }

  await db
    .update(invoices)
    .set({ status: "overdue", updatedAt: new Date().toISOString() })
    .where(eq(invoices.id, id));

  await db.insert(timelineEvents).values({
    id: uuid(),
    invoiceId: id,
    actor: "System",
    message: `Invoice ${invoice.invoiceNumber} reset to demo state`,
    eventType: "info",
    createdAt: new Date().toISOString(),
  });

  return Response.json({ success: true, invoiceId: id });
}

function isPostgresError(err: unknown, code: string): boolean {
  if (!(err instanceof Error)) return false;
  if ("code" in err && (err as Record<string, unknown>).code === code)
    return true;
  if (
    err.cause instanceof Error &&
    "code" in err.cause &&
    (err.cause as Record<string, unknown>).code === code
  )
    return true;
  return false;
}

function isUndefinedTableError(err: unknown): boolean {
  return isPostgresError(err, "42P01");
}
