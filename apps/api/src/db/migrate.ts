import { promises as fs } from "fs";
import path from "path";
import { Migrator, FileMigrationProvider } from "kysely";
import { createDb } from "./index.js";
import { env } from "../env.js";

async function migrateToLatest(): Promise<void> {
  const db = createDb(env.DATABASE_URL);
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(import.meta.dirname, "migrations"),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((r) => {
    if (r.status === "Success") {
      console.log(`migrated: ${r.migrationName}`);
    } else if (r.status === "Error") {
      console.error(`failed: ${r.migrationName}`);
    }
  });

  if (error) {
    console.error("Migration failed", error);
    process.exit(1);
  }

  await db.destroy();
}

migrateToLatest();
