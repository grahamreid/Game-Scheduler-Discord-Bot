/**
 * Owns the shared MongoDB client connection. Keeping it here prevents every
 * database file from independently opening a connection.
 */
import "dotenv/config";
import { Db, MongoClient } from "mongodb";

let client: MongoClient | undefined;

/**
 * Returns the application's MongoDB database. The client is reused so a
 * long-running bot or a warm Lambda does not reconnect for every interaction.
 */
export async function getDatabase(): Promise<Db> {
  if (client === undefined) {
    const uri = process.env.MONGODB_URI;
    if (uri === undefined || uri.length === 0) {
      throw new Error("MONGODB_URI is required. Copy .env.example to .env for local development.");
    }
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db();
}

/** Closes the shared client; intended for scripts and tests, not Discord requests. */
export async function closeDatabase(): Promise<void> {
  await client?.close();
  client = undefined;
}
