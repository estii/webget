import puppeteer, { Browser, Page } from "@cloudflare/puppeteer";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";

const TEN_SECONDS = 10 * 1000;
const KEEP_BROWSER_ALIVE_IN_SECONDS = 60;

const handler: ExportedHandler<Env> = {
  async fetch(req: Request, env: Env) {
    const id = env.SESSIONS.idFromName("browser");
    const obj = env.SESSIONS.get(id);
    const res = await obj.fetch(req.url);

    return res;

    const url = new URL(req.url);
    if (url.pathname.startsWith("/trpc")) {
      return fetchRequestHandler({
        endpoint: "/trpc",
        req: req,
        router: appRouter,
        createContext: () => ({ env, req, url }),
      });
    }
    return new Response("Not found", { status: 404 });
  },
};

export default handler;

export class Session implements DurableObject {
  state: DurableObjectState;
  env: Env;
  keptAliveInSeconds: number;
  browser: Promise<Browser>;
  page: Promise<Page>;

  get storage() {
    return this.state.storage;
  }

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.keptAliveInSeconds = 0;
    this.browser = puppeteer.launch(this.env.BROWSER);
    this.page = this.browser.then((browser) => browser.newPage());
  }

  async fetch(req: Request) {
    const timestamp = new Date().toISOString().split(".")[0];

    let browser = await this.browser;
    let page = await this.page;
    if (!browser.isConnected()) {
      console.log(`Browser DO: Starting new instance`);
      try {
        this.browser = puppeteer.launch(this.env.BROWSER);
        this.page = this.browser.then((browser) => browser.newPage());
        browser = await this.browser;
        page = await this.page;
      } catch (e) {
        console.log(
          `Browser DO: Could not start browser instance. Error: ${e}`
        );
      }
    }

    // Reset keptAlive after each call to the DO
    this.keptAliveInSeconds = 0;

    const id = "h3DW4r";
    // const page = await browser.newPage();

    const width = 1280;
    const height = 720;
    const deviceScaleFactor = 2;

    page.setViewport({ width, height, deviceScaleFactor });
    await page.goto("https://google.com");

    const metrics = await page.metrics();

    const buffer = await page.screenshot({ type: "png" });
    await this.env.SCREENSHOTS.put(`${id}/${timestamp}.png`, buffer, {
      customMetadata: {
        width: String(width),
        height: String(height),
        deviceScaleFactor: String(deviceScaleFactor),
      },
    });

    // Reset keptAlive after performing tasks to the DO.
    this.keptAliveInSeconds = 0;

    // set the first alarm to keep DO alive
    const currentAlarm = await this.storage.getAlarm();
    if (currentAlarm == null) {
      console.log(`Browser DO: setting alarm`);
      await this.storage.setAlarm(Date.now() + 10_000);
    }

    // return new Response(buffer, { headers: { "Content-Type": "image/png" } });
    return Response.json({ metrics });
  }

  async alarm() {
    this.keptAliveInSeconds += 10;

    const browser = await this.browser;

    // Extend browser DO life
    if (this.keptAliveInSeconds < KEEP_BROWSER_ALIVE_IN_SECONDS) {
      console.log(
        `Browser DO: has been kept alive for ${this.keptAliveInSeconds} seconds. Extending lifespan.`
      );
      await this.storage.setAlarm(Date.now() + 10 * 1000);
    } else {
      console.log(
        `Browser DO: exceeded life of ${KEEP_BROWSER_ALIVE_IN_SECONDS}s.`
      );
      if (browser.isConnected()) {
        console.log(`Closing browser.`);
        await browser.close();
      }
    }
  }
}
