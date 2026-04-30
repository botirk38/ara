import { db } from "@/db";
import { customers } from "@/db/schema";
import { z } from "zod";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allCustomers = await db.select().from(customers);
    return Response.json(allCustomers);
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch customers",
      },
      { status: 500 }
    );
  }
}

const createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  whatsapp: z.string().nullable().default(null),
  relationship: z.enum(["good", "neutral", "risky"]),
  avgDaysLate: z.number().int().min(0).default(0),
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

  const parsed = createCustomerSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const id = uuid();
  const now = new Date().toISOString();

  try {
    await db.insert(customers).values({
      id,
      ...parsed.data,
      createdAt: now,
    });

    return Response.json({ id, name: parsed.data.name }, { status: 201 });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to create customer",
      },
      { status: 500 }
    );
  }
}
