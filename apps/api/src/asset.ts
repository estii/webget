import * as orm from "drizzle-orm";

import { sqliteTable, text } from "drizzle-orm/sqlite-core";
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
});

export const assetRelations = orm.relations(assetTable, ({ many }) => ({
  jobs: many(jobs.jobTable),
  screenshots: many(screenshots.screenshotTable),
}));

export function insertAsset(db: DB, url: string) {
  return db.insert(assetTable).values({ url }).returning().get();
}

export function listAssets(db: DB) {
  return db.query.assets.findMany();
}
