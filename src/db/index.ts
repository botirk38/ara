import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

const sql = databaseUrl
  ? neon(databaseUrl, { fetchOptions: { cache: "no-store" } })
  : neon("postgresql://placeholder:placeholder@localhost:5432/placeholder");

export const db = drizzle(sql, { schema });
