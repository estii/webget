import { eq, or, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { assetTable } from "./asset";
import { DB } from "./schema";
import { getId } from "./util";

export const jobTable = sqliteTable("jobs", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date()),
  status: text("status", {
    enum: ["waiting", "queued", "started", "completed", "failed"],
  })
    .notNull()
    .default("waiting"),
  assetId: text("asset_id")
    .notNull()
    .references(() => assetTable.id, { onDelete: "cascade" }),
});

export const jobRelations = relations(jobTable, ({ one }) => ({
  asset: one(assetTable, {
    fields: [jobTable.assetId],
    references: [assetTable.id],
  }),
}));

type JobUpdate = Pick<typeof jobTable.$inferInsert, "id" | "status">;

export function getJob(db: DB, id: string) {
  return db.query.jobs.findFirst({
    where: eq(jobTable.id, id),
    with: {
      asset: true,
    },
  });
}

export function insertJob(db: DB, assetId: string) {
  return db.insert(jobTable).values({ assetId }).returning().get();
}

export function updateJob(db: DB, { id, status }: JobUpdate) {
  return db
    .update(jobTable)
    .set({ status })
    .where(eq(jobTable.id, id))
    .returning()
    .get();
}

export function listNextJobs(db: DB, limit: number) {
  return db.query.jobs.findMany({
    where: or(
      eq(jobTable.status, "queued"),
      eq(jobTable.status, "started"),
      eq(jobTable.status, "waiting")
    ),
    orderBy: jobTable.createdAt,
    limit,
  });
}
