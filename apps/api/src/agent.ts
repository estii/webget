import { asc, ne } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { DB } from "./schema";
import { getId } from "./util";

export const agentTable = sqliteTable("agents", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  state: text("state", { enum: ["ready", "working", "closed"] })
    .notNull()
    .$default(() => "ready"),
  lastActive: integer("last_active", { mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date()),
});

export function upsertAgent(
  db: DB,
  id: string,
  state: "ready" | "working" | "closed"
) {
  const values = { id, state, lastActive: new Date() };
  return db
    .insert(agentTable)
    .values(values)
    .onConflictDoUpdate({ target: agentTable.id, set: values })
    .returning()
    .get();
}

export async function getNextAgent(db: DB) {
  const agents = await db.query.agents.findMany({
    where: ne(agentTable.state, "working"),
    orderBy: asc(agentTable.lastActive),
  });
  const ready = agents.find((a) => a.state === "ready");
  if (ready) return ready;
  return agents[0] || null;
}
