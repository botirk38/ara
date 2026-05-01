import { db } from "@/db";
import { invoices, customers } from "@/db/schema";
import { StatsHeader } from "@/components/stats-header";
import { InvoiceTable } from "@/components/invoice-table";
import type { InvoiceWithCustomer, DashboardStats } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const allInvoices = await db.select().from(invoices);
  const allCustomers = await db.select().from(customers);
  const customerMap = new Map(allCustomers.map((c) => [c.id, c]));

  const invoicesWithCustomers: InvoiceWithCustomer[] = allInvoices.map(
    (inv) => {
      const customer = customerMap.get(inv.customerId)!;
      return { ...inv, customer };
    }
  );

  const stats: DashboardStats = {
    totalOverdue: invoicesWithCustomers
      .filter((i) => i.status === "overdue" || i.status === "recovering")
      .reduce((sum, i) => sum + i.amount, 0),
    invoiceCount: allInvoices.length,
    recoveredToday: invoicesWithCustomers
      .filter(
        (i) => i.status === "promise_to_pay" || i.status === "paid"
      )
      .reduce((sum, i) => sum + i.amount, 0),
    blockedCount: invoicesWithCustomers.filter(
      (i) => i.status === "human_review"
    ).length,
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold">
                ARRA{" "}
                <span className="text-gray-400 font-normal">
                  / Briefcase Collect
                </span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>Specter enabled</span>
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <StatsHeader stats={stats} />

        <div className="mb-4">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Overdue Invoices
          </h2>
        </div>

        <InvoiceTable invoices={invoicesWithCustomers} />
      </main>
    </div>
  );
}
