import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { getId } from "./util";

export const cookieSchema = z
  .object({
    name: z.string(),
    value: z.string(),
    domain: z.string(),
    path: z.string(),
    expires: z.number(),
    httpOnly: z.boolean(),
    secure: z.boolean(),
    sameSite: z.enum(["Strict", "Lax", "None"]),
  })
  .strict();

export type Cookie = z.infer<typeof cookieSchema>;

export const stateSchema = z
  .object({
    url: z.string(),
    cookies: z.array(cookieSchema),
  })
  .strict();

export type State = z.infer<typeof stateSchema>;

export const sessionTable = sqliteTable("sessions", {
  id: text("id")
    .$default(() => getId())
    .primaryKey(),
  url: text("url").notNull(),
  cookies: text("cookies", { mode: "json" }).$type<Cookie[]>().notNull(),
});
