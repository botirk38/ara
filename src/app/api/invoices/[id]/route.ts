import { db } from "@/db";
import { invoices, customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateInvoiceSchema = z.object({
  customerId: z.string().min(1).optional(),
  invoiceNumber: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  dueDate: z.string().min(1).optional(),
  daysOverdue: z.number().int().min(0).optional(),
  status: z
    .enum([
      "overdue",
      "recovering",
      "promise_to_pay",
      "paid",
      "sent",
      "disputed",
      "human_review",
    ])
    .optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const existing = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id));
  if (existing.length === 0) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = updateInvoiceSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  if (updates.customerId) {
    const customerRows = await db
      .select()
      .from(customers)
      .where(eq(customers.id, updates.customerId));
    if (customerRows.length === 0) {
      return Response.json(
        { error: `Customer ${updates.customerId} not found` },
        { status: 404 }
      );
    }
  }

  try {
    await db
      .update(invoices)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(invoices.id, id));

    const updated = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));

    return Response.json(updated[0]);
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Failed to update invoice",
      },
      { status: 500 }
    );
  }
}
