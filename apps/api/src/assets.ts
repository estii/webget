import * as orm from "drizzle-orm";
import * as sqlite from "drizzle-orm/sqlite-core";
import * as jobs from "./jobs";
import { DB } from "./schema";
import * as screenshots from "./screenshots";
import { getId } from "./util";

export const table = sqlite.sqliteTable("assets", {
  id: sqlite
    .text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  url: sqlite.text("url").notNull(),
});

export const relations = orm.relations(table, ({ many }) => ({
  jobs: many(jobs.table),
  screenshots: many(screenshots.table),
}));

export function insert(db: DB, url: string) {
  return db.insert(table).values({ url }).returning().get();
}

export function list(db: DB) {
  return db.query.assets.findMany();
}
