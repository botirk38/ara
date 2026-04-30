import type { DashboardStats } from "@/lib/types";
import {
  Banknote,
  FileText,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";

export function StatsHeader({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <StatCard
        icon={<Banknote className="h-5 w-5 text-red-600" />}
        label="Total Overdue"
        value={`£${stats.totalOverdue.toLocaleString()}`}
        accent="red"
      />
      <StatCard
        icon={<FileText className="h-5 w-5 text-gray-600" />}
        label="Invoices"
        value={String(stats.invoiceCount)}
        accent="gray"
      />
      <StatCard
        icon={<TrendingUp className="h-5 w-5 text-green-600" />}
        label="Recovered Today"
        value={`£${stats.recoveredToday.toLocaleString()}`}
        accent="green"
      />
      <StatCard
        icon={<ShieldAlert className="h-5 w-5 text-amber-600" />}
        label="Actions Blocked"
        value={String(stats.blockedCount)}
        accent="amber"
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  const borderColor =
    accent === "red"
      ? "border-red-200"
      : accent === "green"
      ? "border-green-200"
      : accent === "amber"
      ? "border-amber-200"
      : "border-gray-200";

  return (
    <div
      className={`bg-white rounded-xl border ${borderColor} p-4 flex items-start gap-3`}
    >
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </div>
    </div>
  );
}
