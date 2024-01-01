import { DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { Env } from ".";
import * as agents from "./agents";
import * as assets from "./assets";
import { clientGroupTable, clientTable } from "./client";
import * as jobs from "./jobs";
import * as screenshots from "./screenshots";

const schema = {
  assets: assets.table,
  assetsRelations: assets.relations,
  jobs: jobs.table,
  jobsRelations: jobs.relations,
  agents: agents.table,
  screenshots: screenshots.table,
  screenshotsRelations: screenshots.relations,
  clients: clientTable,
  clientGroups: clientGroupTable,
};

export type Schema = typeof schema;

export type DB = DrizzleD1Database<Schema>;

let db: DB | undefined;

export function getDb(env: Env) {
  if (db) return db;
  return (db = drizzle(env.DB, { schema }));
}
