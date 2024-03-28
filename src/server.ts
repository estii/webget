import staticPlugin from "@elysiajs/static";
import { Elysia, t } from "elysia";
import { PORT } from "./constants";
import { updateOrError } from "./screenshot";
import { getMime } from "./utils";

const app = new Elysia()
  .onResponse(async ({ path }) => {
    if (path === "/stop") {
      await new Promise((resolve) => setTimeout(resolve, 100));
      process.exit(0);
    }
  })
  .get("/stop", async () => {
    console.log("Shutting down...");
  })
  .get(
    "/screenshot",
    async ({ query: { path, headed, diff } }) => {
      return updateOrError({ headless: !headed, diff }, path);
    },
    {
      query: t.Object({
        path: t.String(),
        headed: t.BooleanString(),
        diff: t.BooleanString(),
      }),
    }
  )
  .get(
    "/image",
    async ({ query: { path } }) => {
      const mime = getMime(path);
      const file = Bun.file(path);
      return new Response(file, {
        headers: { "Content-Type": mime, "Cache-Control": "no-store" },
      });
    },
    {
      query: t.Object({
        path: t.String(),
      }),
    }
  )
  .post(
    "/image",
    async ({ query: { path }, body }) => {
      await Bun.write(path, body);
      return new Response(null, { status: 200 });
    },
    {
      query: t.Object({
        path: t.String(),
      }),
      body: t.Uint8Array(),
    }
  )
  .get("/health", () => "OK")

  .use(staticPlugin())
  .listen(PORT);

export type App = typeof app;
