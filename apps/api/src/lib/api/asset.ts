// import { eq } from "drizzle-orm";
// import { sqliteTable, text } from "drizzle-orm/sqlite-core";
// import { customAlphabet } from "nanoid";
// import { z } from "zod";
// import { Action } from "../api";
// import { getDb } from "../db";
// import { procedure, router } from "../trpc";

// const getId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

// export const assetsTable = sqliteTable("assets", {
//   id: text("id")
//     .$default(() => getId())
//     .primaryKey(),
//   url: text("url").notNull(),
//   actions: text("actions", { mode: "json" }).$type<Action[]>().notNull(),
// });

type Automation = {
  id: string;
  name: string;
  path: string;
  actions: Action[];
};

type Action = {
  type: string;
  payload: Record<string, unknown>;
};

// https://webget.com/a/{automation.id}/latest/name.jpg
// https://webget.com/a/{automation.id}/{asset.createdAt}/name.jpg

type Site = {
  id: string;
  name: string;
  url: string;
};

type Page = {
  id: string;
  name: string;
  siteId: string;
  path: string;
};

type State = {
  id: string;
  pageId: string;
  name: string;
  actions: Action[];
};

type Screenshot = {
  id: string;
  selector: string;
};

type Image = {
  id: string;
  createdAt: Date;
  automation: Automation;
  variables: Record<string, string>;
  width: number;
  height: number;
};

type Job = {
  id: string;
  createdAt: Date;
  automation: Automation;
  status: "pending";
};

// session
// -> page
//   -> state
