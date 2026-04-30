import { db } from "@/db";
import { specterEnrichments } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { SpecterEnrichment } from "./types";

export async function enrichDebtor(
  customerId: string
): Promise<SpecterEnrichment> {
  const rows = await db
    .select()
    .from(specterEnrichments)
    .where(eq(specterEnrichments.customerId, customerId));

  const existing = rows[0];

  if (!existing) {
    throw new Error(
      `No Specter enrichment data found for customer ${customerId}. Run enrichment before recovery.`
    );
  }

  return {
    riskSignal: existing.riskSignal as "low" | "medium" | "high",
    summary: `${existing.companyName}: ${existing.riskSignal} risk`,
    evidence: [
      existing.revenueSignal,
      existing.newsSignal,
    ].filter(Boolean) as string[],
    revenueSignal: existing.revenueSignal ?? undefined,
    newsSignal: existing.newsSignal ?? undefined,
  };
}
