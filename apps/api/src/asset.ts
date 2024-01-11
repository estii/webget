import * as orm from "drizzle-orm";

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { Env } from ".";
import { jobTable } from "./job";
import { DB, getDb } from "./schema";
import * as screenshots from "./screenshot";
import { getId } from "./util";

export const assetTable = sqliteTable("assets", {
  version: integer("version").notNull().default(0),
  id: text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  durableObjectId: text("durable_object_id").notNull(),
  url: text("url").notNull(),
  width: integer("width").notNull().default(1280),
  height: integer("height").notNull().default(720),
  deviceScaleFactor: integer("deviceScaleFactor").notNull().default(2),
});

export type AssetInsert = typeof assetTable.$inferInsert;

export const assetRelations = orm.relations(assetTable, ({ many }) => ({
  jobs: many(jobTable),
  screenshots: many(screenshots.screenshotTable),
}));

export function insertAsset(db: DB, asset: AssetInsert) {
  return db.insert(assetTable).values(asset).returning().get();
}

export function searchAssets(db: DB) {
  return db.select().from(assetTable).all();
}

export async function createAsset(env: Env) {
  const id = env.ASSETS.newUniqueId();
  const obj = env.ASSETS.get(id);
  const db = getDb(env);

  const durableObjectId = id.toString();
  await insertAsset(db, { durableObjectId, url: "https://apple.com" });
}
