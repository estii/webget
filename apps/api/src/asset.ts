import * as orm from "drizzle-orm";

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import * as jobs from "./job";
import { DB } from "./schema";
import * as screenshots from "./screenshot";
import { getId } from "./util";

export const assetTable = sqliteTable("assets", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  url: text("url").notNull(),
  version: integer("version")
    .notNull()
    .$default(() => 0),
});

export const assetRelations = orm.relations(assetTable, ({ many }) => ({
  jobs: many(jobs.jobTable),
  screenshots: many(screenshots.screenshotTable),
}));

export function insertAsset(db: DB, url: string) {
  return db.insert(assetTable).values({ url }).returning().get();
}

export function searchAssets(db: DB) {
  return db.select().from(assetTable).all();
}
