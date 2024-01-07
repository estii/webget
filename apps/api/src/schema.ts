import { DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { Env } from ".";
import * as agents from "./agent";
import * as assets from "./asset";
import { clientGroupTable, clientTable } from "./client";
import * as jobs from "./job";
import { screenshotRelations, screenshotTable } from "./screenshot";

const schema = {
  assets: assets.assetTable,
  assetsRelations: assets.assetRelations,
  jobs: jobs.jobTable,
  jobsRelations: jobs.jobRelations,
  agents: agents.agentTable,
  screenshots: screenshotTable,
  screenshotsRelations: screenshotRelations,
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
