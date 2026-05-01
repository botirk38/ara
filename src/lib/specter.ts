import { db } from "@/db";
import { specterEnrichments, customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { SpecterEnrichment } from "./types";

export class EnrichmentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnrichmentNotFoundError";
  }
}

const SPECTER_API_BASE = "https://app.tryspecter.com/api/v1";

interface SpecterCompany {
  id: string;
  organization_name: string;
  organization_rank?: number;
  description?: string;
  tagline?: string;
  total_funding_amount_currency?: string;
  total_funding_amount?: number;
  last_funding_date?: string;
  employee_count?: number;
  founded_date?: string;
  status?: string;
  growth_score?: number;
  news?: Array<{ title?: string; sentiment?: string }>;
  revenue_range?: string;
  [key: string]: unknown;
}

async function specterFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const apiKey = process.env.SPECTER_API_KEY;
  if (!apiKey) {
    throw new Error("SPECTER_API_KEY is required for Specter enrichment.");
  }

  const res = await fetch(`${SPECTER_API_BASE}${path}`, {
    ...init,
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Specter API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

function domainFromEmail(email: string): string {
  return email.split("@")[1] ?? "";
}

function deriveRiskSignal(
  company: SpecterCompany
): "low" | "medium" | "high" {
  const rank = company.organization_rank;
  if (rank !== undefined && rank !== null) {
    if (rank <= 5_000) return "low";
    if (rank <= 50_000) return "medium";
    return "high";
  }
  return "medium";
}

function buildRevenueSignal(company: SpecterCompany): string | null {
  const parts: string[] = [];
  if (company.revenue_range) parts.push(company.revenue_range);
  if (company.total_funding_amount) {
    const currency = company.total_funding_amount_currency ?? "USD";
    parts.push(
      `Total funding: ${currency} ${company.total_funding_amount.toLocaleString()}`
    );
  }
  if (company.employee_count) {
    parts.push(`${company.employee_count} employees`);
  }
  if (company.growth_score !== undefined && company.growth_score !== null) {
    parts.push(`Growth score: ${company.growth_score}`);
  }
  return parts.length > 0 ? parts.join(" — ") : null;
}

function buildNewsSignal(company: SpecterCompany): string | null {
  if (company.description) return company.description;
  if (company.tagline) return company.tagline;
  return null;
}

async function fetchFromSpecter(
  domain: string,
  companyName: string
): Promise<SpecterCompany | null> {
  // 1. Try enrichment by domain
  if (domain) {
    try {
      const results = await specterFetch<SpecterCompany[]>("/companies", {
        method: "POST",
        body: JSON.stringify({ domain }),
      });
      if (results.length > 0) return results[0];
    } catch {
      // domain lookup failed — fall through to name search
    }
  }

  // 2. Fallback: search by company name
  try {
    const results = await specterFetch<SpecterCompany[]>(
      `/companies/search?query=${encodeURIComponent(companyName)}`
    );
    if (results.length > 0) return results[0];
  } catch {
    // name search failed
  }

  return null;
}

export async function enrichDebtor(
  customerId: string
): Promise<SpecterEnrichment> {
  const customerRows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId));
  const customer = customerRows[0];
  if (!customer) {
    throw new EnrichmentNotFoundError(`Customer ${customerId} not found.`);
  }

  const domain = domainFromEmail(customer.email);
  const company = await fetchFromSpecter(domain, customer.name);

  if (company) {
    const riskSignal = deriveRiskSignal(company);
    const revenueSignal = buildRevenueSignal(company);
    const newsSignal = buildNewsSignal(company);
    const companyName = company.organization_name || customer.name;

    const existing = await db
      .select()
      .from(specterEnrichments)
      .where(eq(specterEnrichments.customerId, customerId));

    const data = {
      customerId,
      companyName,
      riskSignal,
      revenueSignal,
      newsSignal,
      raw: JSON.stringify(company),
    };

    if (existing.length > 0) {
      await db
        .update(specterEnrichments)
        .set(data)
        .where(eq(specterEnrichments.customerId, customerId));
    } else {
      await db
        .insert(specterEnrichments)
        .values({ id: uuid(), ...data, createdAt: new Date().toISOString() });
    }

    return {
      riskSignal,
      summary: `${companyName}: ${riskSignal} risk`,
      evidence: [revenueSignal, newsSignal].filter(Boolean) as string[],
      revenueSignal: revenueSignal ?? undefined,
      newsSignal: newsSignal ?? undefined,
    };
  }

  // No API result — fall back to cached DB enrichment
  const rows = await db
    .select()
    .from(specterEnrichments)
    .where(eq(specterEnrichments.customerId, customerId));

  const cached = rows[0];
  if (!cached) {
    throw new EnrichmentNotFoundError(
      `No Specter enrichment data found for customer ${customerId}. Run enrichment before recovery.`
    );
  }

  return {
    riskSignal: cached.riskSignal as "low" | "medium" | "high",
    summary: `${cached.companyName}: ${cached.riskSignal} risk`,
    evidence: [cached.revenueSignal, cached.newsSignal].filter(
      Boolean
    ) as string[],
    revenueSignal: cached.revenueSignal ?? undefined,
    newsSignal: cached.newsSignal ?? undefined,
  };
}
