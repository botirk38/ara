import { db } from "@/db";
import { invoices, customers } from "@/db/schema";

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
  } catch {
    return Response.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
