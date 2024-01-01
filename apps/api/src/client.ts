import { eq } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { DB } from "./schema";
import { getId } from "./util";

export const clientGroupTable = sqliteTable("client_groups", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  cvrVersion: integer("cvr_version"),
  clientVersion: integer("client_version").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date()),
});

export type ClientGroup = typeof clientGroupTable.$inferSelect;

export const clientTable = sqliteTable("clients", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  clientGroupId: text("client_group_id")
    .notNull()
    .references(() => clientGroupTable.id),
  lastMutationID: integer("last_mutation_id").notNull(),
  clientVersion: integer("client_version").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date()),
});

export type Client = typeof clientTable.$inferSelect;

export async function getClientGroupForUpdate(db: DB, clientGroupID: string) {
  const prevClientGroup = await getClientGroup(db, clientGroupID, {
    forUpdate: true,
  });
  return (
    prevClientGroup ?? {
      id: clientGroupID,
      cvrVersion: null,
      clientVersion: 0,
    }
  );
}

export async function getClientGroup(
  db: DB,
  clientGroupID: string,
  { forUpdate }: { forUpdate?: boolean } = {}
) {
  return db.query.clientGroups.findFirst({
    where: eq(clientGroupTable.id, clientGroupID),
  });
}
