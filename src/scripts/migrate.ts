import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { openDatabase } from "../infrastructure/database/connection";
import { applyMigrations } from "../infrastructure/database/migrate";

const databasePath = resolve(process.env.DATABASE_PATH ?? "data/board-game-scheduler.db");
mkdirSync(dirname(databasePath), { recursive: true });
const { sqlite } = openDatabase(databasePath);
applyMigrations(sqlite);
sqlite.close();
console.log(`Migrations applied to ${databasePath}`);
