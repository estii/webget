import * as orm from "drizzle-orm";
import * as sqlite from "drizzle-orm/sqlite-core";
import * as asset from "./assets";
import { DB } from "./schema";
import { getId } from "./util";

export const table = sqlite.sqliteTable("jobs", {
  id: sqlite
    .text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  createdAt: sqlite
    .integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date()),
  status: sqlite
    .text("status", {
      enum: ["waiting", "queued", "started", "completed", "failed"],
    })
    .notNull()
    .default("waiting"),
  assetId: sqlite
    .text("asset_id")
    .notNull()
    .references(() => asset.table.id, { onDelete: "cascade" }),
});

export const relations = orm.relations(table, ({ one }) => ({
  asset: one(asset.table, {
    fields: [table.assetId],
    references: [asset.table.id],
  }),
}));

type Update = Pick<typeof table.$inferInsert, "id" | "status">;

export function get(db: DB, id: string) {
  return db.query.jobs.findFirst({
    where: orm.eq(table.id, id),
    with: {
      asset: true,
    },
  });
}

export function insert(db: DB, assetId: string) {
  return db.insert(table).values({ assetId }).returning().get();
}

export function update(db: DB, { id, status }: Update) {
  return db
    .update(table)
    .set({ status })
    .where(orm.eq(table.id, id))
    .returning()
    .get();
}

export function listNext(db: DB, limit: number) {
  return db.query.jobs.findMany({
    where: orm.or(
      orm.eq(table.status, "queued"),
      orm.eq(table.status, "started"),
      orm.eq(table.status, "waiting")
    ),
    orderBy: table.createdAt,
    limit,
  });
}
