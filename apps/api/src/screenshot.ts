import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { assetTable } from "./asset";
import { DB } from "./schema";
import { getId } from "./util";

export const screenshotTable = sqliteTable("screenshots", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  deviceScaleFactor: integer("deviceScaleFactor").notNull(),
  url: text("url").notNull(),
  assetId: text("asset_id")
    .notNull()
    .references(() => assetTable.id, { onDelete: "cascade" }),
});

export const screenshotRelations = relations(screenshotTable, ({ one }) => ({
  asset: one(assetTable, {
    fields: [screenshotTable.assetId],
    references: [assetTable.id],
  }),
}));

type InsertScreenshot = typeof screenshotTable.$inferInsert;

export function insertScreenshot(db: DB, insert: InsertScreenshot) {
  return db.insert(screenshotTable).values(insert).returning().get();
}
