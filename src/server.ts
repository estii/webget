import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { PORT, SERVER_URL } from "./constants";
import { assetSchema } from "./schema";
import { update } from "./screenshot";

export const api = new Hono()
  .use("/static/*", serveStatic({ root: "./static" }))
  .use("/assets/*", serveStatic({ root: "./" }))
  .post("/screenshot", zValidator("json", assetSchema), async (c) => {
    const asset = c.req.valid("json");
    const result = await update(asset);
    return c.json(result);
  })
  .get("/stop", (c) => c.text("ok"))
  .get("/health", (c) => c.text("ok"));

export function runServer(port = PORT) {
  console.log(`Started server ${SERVER_URL}`);
  const server = Bun.serve({
    fetch: (req) => {
      if (req.url.endsWith("/stop")) {
        server.stop();
      }
      return api.fetch(req);
    },
    port,
  });
  return server;
}

export type API = typeof api;
