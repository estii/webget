import { Browser, Page, launch } from "@cloudflare/puppeteer";
import { Env } from ".";
import * as agents from "./agent";
import * as jobs from "./job";
import { getDb } from "./schema";
import * as screenshots from "./screenshot";

const KEEP_BROWSER_ALIVE_IN_SECONDS = 60;

export class Agent implements DurableObject {
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
    this.browser = launch(this.env.BROWSER);
    this.page = this.browser.then((browser) => browser.newPage());
  }

  async fetch(req: Request) {
    const db = getDb(this.env);
    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId");

    const job = await jobs.getJob(db, jobId);
    await jobs.updateJob(db, { id: job.id, status: "started" });
    console.log(job.id, "started");

    await agents.upsertAgent(db, this.state.id.toString(), "working");

    const timestamp = new Date().toISOString().split(".")[0];

    let browser = await this.browser;
    let page = await this.page;
    if (!browser.isConnected()) {
      console.log(`Browser DO: Starting new instance`);
      try {
        this.browser = launch(this.env.BROWSER);
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

    const width = 1280;
    const height = 720;
    const deviceScaleFactor = 2;

    page.setViewport({ width, height, deviceScaleFactor });
    await page.goto(job.asset.url, { waitUntil: "networkidle2" });

    const metrics = await page.metrics();

    const key = `${job.asset.id}/${timestamp}.png`;
    const buffer = await page.screenshot({ type: "png" });
    await this.env.SCREENSHOTS.put(key, buffer);

    await screenshots.insertScreenshot(db, {
      width,
      height,
      deviceScaleFactor,
      assetId: job.asset.id,
      url: `https://webget2.estii.workers.dev/file/${key}`,
    });

    // Reset keptAlive after performing tasks to the DO.
    this.keptAliveInSeconds = 0;

    // set the first alarm to keep DO alive
    const currentAlarm = await this.storage.getAlarm();
    if (currentAlarm == null) {
      console.log(`Browser DO: setting alarm`);
      await this.storage.setAlarm(Date.now() + 10_000);
    }

    await agents.upsertAgent(db, this.state.id.toString(), "ready");
    await jobs.updateJob(db, { id: job.id, status: "completed" });
    console.log(job.id, "completed");

    return new Response("Ok");
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
        const db = getDb(this.env);
        await agents.upsertAgent(db, this.state.id.toString(), "closed");
        await browser.close();
      }
    }
  }
}
