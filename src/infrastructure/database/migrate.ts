import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SqliteDatabase } from "./connection";

const migrationsDirectory = join(__dirname, "migrations");

export function applyMigrations(sqlite: SqliteDatabase): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    sqlite.prepare("SELECT name FROM schema_migrations").all().map((row) => (row as { name: string }).name),
  );
  const migrations = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const insertMigration = sqlite.prepare(
    "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
  );
  const runMigration = sqlite.transaction((name: string, sql: string) => {
    sqlite.exec(sql);
    insertMigration.run(name, new Date().toISOString());
  });

  for (const name of migrations) {
    if (!applied.has(name)) {
      runMigration(name, readFileSync(join(migrationsDirectory, name), "utf8"));
    }
  }
}
