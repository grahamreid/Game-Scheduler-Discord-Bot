import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/** The low-level SQLite connection, used for migrations and connection cleanup. */
export type SqliteDatabase = Database.Database;
/** Drizzle's typed query object for this project's SQLite tables. */
export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

/** Opens a local SQLite file and enables foreign-key protection for this connection. */
export function openDatabase(path: string): { sqlite: SqliteDatabase; db: AppDatabase } {
  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");
  return { sqlite, db: drizzle(sqlite, { schema }) };
}
