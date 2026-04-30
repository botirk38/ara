import { NextRequest } from "next/server";
import { enrichDebtor } from "@/lib/specter";

export async function POST(req: NextRequest) {
  const { customerId } = await req.json();

  if (!customerId) {
    return Response.json(
      { error: "customerId is required" },
      { status: 400 }
    );
  }

  try {
    const result = await enrichDebtor(customerId);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Enrichment failed",
      },
      { status: 404 }
    );
  }
}
