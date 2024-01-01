import { asc, ne } from "drizzle-orm";
import * as sqlite from "drizzle-orm/sqlite-core";
import { DB } from "./schema";
import { getId } from "./util";

export const table = sqlite.sqliteTable("agents", {
  id: sqlite
    .text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  state: sqlite
    .text("state", { enum: ["ready", "working", "closed"] })
    .notNull()
    .$default(() => "ready"),
  lastActive: sqlite
    .integer("last_active", { mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date()),
});

export function upsert(
  db: DB,
  id: string,
  state: "ready" | "working" | "closed"
) {
  const values = { id, state, lastActive: new Date() };
  return db
    .insert(table)
    .values(values)
    .onConflictDoUpdate({ target: table.id, set: values })
    .returning()
    .get();
}

export async function getNextAgent(db: DB) {
  const agents = await db.query.agents.findMany({
    where: ne(table.state, "working"),
    orderBy: asc(table.lastActive),
  });
  const ready = agents.find((a) => a.state === "ready");
  if (ready) return ready;
  return agents[0] || null;
}
