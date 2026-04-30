import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import path from "path";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });

  console.log("Migrations applied.");
}

main().catch(console.error);
