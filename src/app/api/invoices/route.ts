import { db } from "@/db";
import { invoices, customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allInvoices = await db.select().from(invoices);
    const allCustomers = await db.select().from(customers);
    const customerMap = new Map(allCustomers.map((c) => [c.id, c]));

    const result = allInvoices.map((inv) => ({
      ...inv,
      customer: customerMap.get(inv.customerId),
    }));

    return Response.json(result);
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch invoices",
      },
      { status: 500 }
    );
  }
}

const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("GBP"),
  dueDate: z.string().min(1),
  daysOverdue: z.number().int().min(0),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = createInvoiceSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { customerId, invoiceNumber, amount, currency, dueDate, daysOverdue } =
    parsed.data;

  const customerRows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId));
  if (customerRows.length === 0) {
    return Response.json(
      { error: `Customer ${customerId} not found` },
      { status: 404 }
    );
  }

  const now = new Date().toISOString();
  const id = uuid();

  try {
    await db.insert(invoices).values({
      id,
      customerId,
      invoiceNumber,
      amount,
      currency,
      dueDate,
      daysOverdue,
      status: "overdue",
      createdAt: now,
      updatedAt: now,
    });

    return Response.json({ id, invoiceNumber }, { status: 201 });
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Failed to create invoice",
      },
      { status: 500 }
    );
  }
}
