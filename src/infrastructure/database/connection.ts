import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type SqliteDatabase = Database.Database;
export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

export function openDatabase(path: string): { sqlite: SqliteDatabase; db: AppDatabase } {
  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");
  return { sqlite, db: drizzle(sqlite, { schema }) };
}
