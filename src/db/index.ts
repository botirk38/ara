import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or DATABASE_URL_UNPOOLED must be set. See README for setup instructions."
  );
}

const sql = neon(databaseUrl, { fetchOptions: { cache: "no-store" } });

export const db = drizzle(sql, { schema });
