import { DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { Env } from ".";
import { agentTable } from "./agent";
import { assetRelations, assetTable } from "./asset";
import { clientGroupTable, clientTable } from "./client";
import { jobRelations, jobTable } from "./job";
import { screenshotRelations, screenshotTable } from "./screenshot";
import { userTable } from "./user";

const schema = {
  assets: assetTable,
  assetsRelations: assetRelations,
  jobs: jobTable,
  jobsRelations: jobRelations,
  agents: agentTable,
  screenshots: screenshotTable,
  screenshotsRelations: screenshotRelations,
  clients: clientTable,
  clientGroups: clientGroupTable,
  users: userTable,
};

export type Schema = typeof schema;

export type DB = DrizzleD1Database<Schema>;

let db: DB | undefined;

export function getDb(env: Env) {
  if (db) return db;
  return (db = drizzle(env.DB, { schema }));
}
