import { eq } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { getDb } from "./db";
import { procedure, router } from "./trpc";

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

const getId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

export const stateTable = sqliteTable("states", {
  id: text("id")
    .$default(() => getId())
    .primaryKey(),
  url: text("url").notNull(),
  cookies: text("cookies", { mode: "json" }).$type<Cookie[]>().notNull(),
});

export const stateRouter = router({
  put: procedure.input(stateSchema).mutation(async ({ ctx, input }) => {
    const db = getDb(ctx.env);
    const state = await db.insert(stateTable).values(input).returning().get();
    console.log(state);
    return { id: state.id };
  }),
  get: procedure.input(z.string()).query(async ({ ctx, input }) => {
    const db = getDb(ctx.env);
    return db.select().from(stateTable).where(eq(stateTable.id, input)).get();
  }),
});
