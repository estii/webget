import { and, eq, gt } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { DB } from "./schema";
import { userTable } from "./user";
import { getId } from "./util";

export const clientGroupTable = sqliteTable("client_groups", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id),
  clientVersion: integer("client_version").notNull(),
  cvrVersion: integer("cvr_version"),
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
  durableObjectId: text("durable_object_id").notNull(),
  lastMutationId: integer("last_mutation_id").notNull(),
  clientVersion: integer("client_version").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date()),
});

export type Client = typeof clientTable.$inferSelect;

export async function getClientGroupForUpdate(db: DB, clientGroupID: string) {
  const prevClientGroup = await getClientGroup(db, clientGroupID);
  return (
    prevClientGroup ?? {
      id: clientGroupID,
      cvrVersion: null,
      clientVersion: 0,
    }
  );
}

export async function getClientGroup(db: DB, clientGroupID: string) {
  return db.query.clientGroups.findFirst({
    where: eq(clientGroupTable.id, clientGroupID),
  });
}

export function searchClients(
  db: DB,
  clientGroupId: string,
  sinceClientVersion: number
) {
  return db.query.clients.findMany({
    where: and(
      eq(clientTable.clientGroupId, clientGroupId),
      gt(clientTable.clientVersion, sinceClientVersion)
    ),
    columns: {
      id: true,
      clientGroupId: true,
      lastMutationId: true,
      clientVersion: true,
    },
  });
}
