import { DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { stateTable } from "./states";

export const schema = {
  states: stateTable,
};

export type Schema = typeof schema;

export type DB = DrizzleD1Database<Schema>;

let db: DB | undefined;

export function getDb(env: Env) {
  if (db) return db;
  return (db = drizzle(env.DB, { schema }));
}
