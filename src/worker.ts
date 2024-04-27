import { launch, type Browser } from "@cloudflare/puppeteer";
import type { DurableObjectLocationHint } from "@cloudflare/workers-types";
import { zValidator } from "@hono/zod-validator";
import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { PuppeteerSession, getAssetUrl } from "./browser/puppeteer";
import { assetSchema, type Asset } from "./schema";
import type { ScreenshotOutcome } from "./types";
import { getErrorMessage, getId } from "./utils";
// @ts-ignore - magical workers thing
import manifest from "__STATIC_CONTENT_MANIFEST";
import { serveStatic } from "hono/cloudflare-workers";
import { z } from "zod";

type Bindings = {
  browser: Fetcher;
  screenshots: R2Bucket;
  browserSession: DurableObjectNamespace<BrowserSession>;
};

const KEEP_ALIVE = 60;

export class BrowserSession extends DurableObject<Bindings> {
  keptAlive = 0;
  browser: Browser | undefined;

  async render(asset: Asset) {
    if (!this.browser || !this.browser.isConnected()) {
      console.log("launch new browser session");
      // @ts-ignore - type error from @cloudflare/puppeteer
      this.browser = await launch(this.env.browser);
    }

    // reset keptAliveInSeconds on request
    this.keptAlive = 0;

    const result = await render(this.env, this.browser, asset);

    //  reset keptAliveInSeconds when finished
    this.keptAlive = 0;

    // set the first alarm to keep DO alive
    let currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm == null) {
      console.log("setting alarm");
      await this.ctx.storage.setAlarm(Date.now() + 10_000);
    }

    return result;
  }

  async alarm() {
    this.keptAlive += 10;

    console.log(`BrowserSession kept alive for ${this.keptAlive}s`);
    if (this.keptAlive < KEEP_ALIVE) {
      console.log("keep alive for another 10 seconds");
      await this.ctx.storage.setAlarm(Date.now() + 10_000);
      if (this.browser) {
        console.log("poking browser");
        await this.browser.version();
      }
    } else {
      console.log(`exceeded life of ${KEEP_ALIVE}s`);
      if (this.browser) {
        console.log("closing browser");
        await this.browser.close();
      }
    }
  }
}

const SERVER_URL = "https://webget.estii.workers.dev";

async function render(
  env: Bindings,
  browser: Browser,
  asset: Asset
): Promise<ScreenshotOutcome> {
  const url = new URL(getAssetUrl(asset, asset.url));

  if (asset.inputs) {
    const entries = await Promise.all(
      Object.entries(asset.inputs).map(([key, value]) => {
        return new Promise<[string, ScreenshotOutcome]>(async (resolve) => {
          const result = await render(env, browser, value);
          resolve([key, result]);
        });
      })
    );
    for (const [key, value] of entries) {
      if (value.status === "error") {
        return value;
      } else {
        url.searchParams.set(key, value.path);
      }
    }
  }
  const page = await browser.newPage();

  try {
    const session = new PuppeteerSession(page as any, asset);
    await session.init();

    await session.goto({ url: url.href });

    for (const action of asset.actions ?? []) {
      await session.doAction(action);
    }
    const image = await session.screenshot(asset);
    await page.close();

    const key = `${getId()}.${asset.type === "jpeg" ? "jpg" : "png"}`;
    await env.screenshots.put(key, image, {
      httpMetadata: { contentType: `image/${asset.type}` },
    });

    return {
      status: "created",
      path: `${SERVER_URL}/screenshots/${key}`,
    };
  } catch (error) {
    await page.close();
    return { status: "error", error: getErrorMessage(error) };
  }
}

const locationHintSchema = z.enum([
  "wnam",
  "enam",
  "sam",
  "weur",
  "eeur",
  "apac",
  "oc",
  "afr",
  "me",
]);

const app = new Hono<{ Bindings: Bindings }>()
  .get("/*", serveStatic({ manifest }))
  .post("/screenshots", zValidator("json", assetSchema), async (c) => {
    const asset = c.req.valid("json");
    const num = 1;
    const locationHint: DurableObjectLocationHint = "apac";
    const id = c.env.browserSession.idFromName(locationHint + num.toString());
    const stub = c.env.browserSession.get(id, { locationHint });
    const result = await stub.render(asset);
    return c.json(result);
  })
  .get("/screenshots/*", async (c) => {
    const url = new URL(c.req.url);
    const key = url.pathname.slice("/screenshots/".length);
    const image = await c.env.screenshots.get(key);

    if (image) {
      const data = await image.arrayBuffer();
      const type = image.httpMetadata?.contentType ?? "";
      return c.body(data, {
        status: 200,
        headers: { "Content-Type": type },
      });
    }
    return c.notFound();
  })
  .get("/", (c) => c.text("ok"));

export default app;
