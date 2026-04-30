import { db } from "@/db";
import { invoices, customers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const allInvoices = db.select().from(invoices).all();

  const result = allInvoices.map((inv) => {
    const customer = db
      .select()
      .from(customers)
      .where(eq(customers.id, inv.customerId))
      .get();
    return { ...inv, customer };
  });

  return Response.json(result);
}
