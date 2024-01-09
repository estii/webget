import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { DB } from "./schema";
import { getId } from "./util";

export const userTable = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$default(() => getId()),
  version: integer("version")
    .notNull()
    .$default(() => 0),
});

export function searchUsers(db: DB) {
  return db.select().from(userTable).all();
}
