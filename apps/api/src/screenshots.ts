import * as orm from "drizzle-orm";
import * as sqlite from "drizzle-orm/sqlite-core";
import * as assets from "./assets";
import { DB } from "./schema";
import { getId } from "./util";

export const table = sqlite.sqliteTable("screenshots", {
  id: sqlite
    .text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  width: sqlite.integer("width").notNull(),
  height: sqlite.integer("height").notNull(),
  deviceScaleFactor: sqlite.integer("deviceScaleFactor").notNull(),
  url: sqlite.text("url").notNull(),
  assetId: sqlite
    .text("asset_id")
    .notNull()
    .references(() => assets.table.id, { onDelete: "cascade" }),
});

export const relations = orm.relations(table, ({ one }) => ({
  asset: one(assets.table, {
    fields: [table.assetId],
    references: [assets.table.id],
  }),
}));

type Insert = typeof table.$inferInsert;

export function insert(db: DB, insert: Insert) {
  return db.insert(table).values(insert).returning().get();
}
