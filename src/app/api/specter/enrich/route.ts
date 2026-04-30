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

  const result = await enrichDebtor(parsed.data.customerId);
  return Response.json(result);
}
