import { NextRequest } from "next/server";
import { z } from "zod";
import { enrichDebtor } from "@/lib/specter";

const enrichRequestSchema = z.object({
  customerId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = enrichRequestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const result = await enrichDebtor(parsed.data.customerId);
    return Response.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Enrichment failed";

    const isNotFound =
      message.includes("not found") || message.includes("No Specter enrichment");
    const isMissingConfig = message.includes("SPECTER_API_KEY is required");

    const status = isMissingConfig ? 503 : isNotFound ? 404 : 502;

    return Response.json({ error: message }, { status });
  }
}
