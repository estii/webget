import { unlink } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";
import { chromium, type Frame, type Page } from "playwright";
import type { SsimResult } from "./browser";
import { ClickAction, Config, getConfig } from "./config";
import { PORT, SERVER_URL } from "./constants";

function getType(path: string) {
  if (path.endsWith(".png")) {
    return "png";
  }
  if (path.endsWith(".jpg")) {
    return "jpeg";
  }
  throw new Error(`Invalid file type ${path}`);
}

function getMime(path: string) {
  const type = getType(path);
  return `image/${type}` as const;
}

async function getScript() {
  const output = await Bun.build({
    entrypoints: ["browser.ts"],
    target: "browser",
  });

  const [script] = output.outputs;
  if (script) return script.text();

  throw new Error("No script found");
}

async function getBaseConfig(path: string) {
  const dir = dirname(path);
  if (dir === "/") {
    return null;
  }

  const file = Bun.file(join(dir, "webget.json"));
  if (await file.exists()) {
    return Config.parse(await file.json());
  }

  return getBaseConfig(dir);
}

const headedBrowser = chromium.launch({ headless: false });
const headlessBrowser = chromium.launch({ headless: true });

const runtime = headlessBrowser.then(async (browser) => {
  const page = await browser.newPage();
  const script = await getScript();
  await page.addInitScript({ content: script });
  await page.goto(SERVER_URL);
  return page;
});

async function getBrowser(headless = true) {
  if (headless) {
    return headlessBrowser;
  }
  return headedBrowser;
}

async function getScreenshot(path: string, headless: boolean) {
  const config = await getConfig(path);
  const browser = await getBrowser(headless);
  const context = await browser.newContext({
    screen: { width: config.width, height: config.height },
    deviceScaleFactor: config.deviceScaleFactor,
    baseURL: config.baseUrl,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(2000);
  page.setDefaultNavigationTimeout(10000);
  // page.on("console", (msg) => console.log("log", msg.text()));
  // page.on("pageerror", (msg) => console.log("error", msg));

  const result = await getScreenshotResult(page, config);

  await page.close();
  await context.close();
  return Response.json(result);
}

async function getScreenshotResult(page: Page, config: Config) {
  try {
    return await updateScreenshot(page, config);
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", error: error.message };
    }
    return { status: "error", error: "Unknown error" };
  }
}

async function clickAction(page: Page, action: ClickAction) {
  let target: Page | Frame = page;

  if (action.frame) {
    const frame = page.frame(action.frame);
    if (!frame) {
      throw new Error(`frame "${action.frame}" not found`);
    }
    target = frame;
  }

  try {
    await target.locator(action.selector).click();
  } catch (error) {
    throw new Error(`selector "${action.selector}" not found`);
  }
}

async function updateScreenshot(page: Page, config: Config) {
  const output = config.path;
  const temp = join(os.tmpdir(), output);

  await page.goto(config.url, { waitUntil: "networkidle" });

  for (const action of config.actions) {
    if (action.type === "click") {
      await clickAction(page, action);
    }
  }

  const exists = await Bun.file(output).exists();
  const path = exists ? temp : output;
  const type = getType(output);

  await page.screenshot({ path, type });

  if (exists) {
    const result = await compareImages(output, temp);

    const matched = result.ssim > 0.99;
    if (!matched) {
      await Bun.write(output, Bun.file(temp));
    }
    await unlink(temp);

    return {
      status: matched ? "matched" : "updated",
      error: matched
        ? undefined
        : `similarity ${Math.round(result.ssim * 100)}%`,
    };
  }

  return { status: "created" };
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/") {
      return new Response("");
    }

    if (path === "/screenshot") {
      const path = url.searchParams.get("path");
      const headless = url.searchParams.get("headed") !== "1";
      if (!path) {
        console.log("No path");
        return new Response(null, { status: 400 });
      }
      const result = await getScreenshot(path, headless);
      return result;
    }

    if (path === "/image") {
      const path = url.searchParams.get("path");
      if (!path) {
        return new Response(null, { status: 400 });
      }
      const mime = getMime(path);
      const file = Bun.file(path);
      return new Response(file, { headers: { "Content-Type": mime } });
    }

    return new Response(null, { status: 404 });
  },
  error() {
    return new Response(null, { status: 404 });
  },
});

async function compareImages(path1: string, path2: string) {
  const page = await runtime;
  return page.evaluate(({ path1, path2 }) => window.compare(path1, path2), {
    path1,
    path2,
  });
}

declare global {
  interface Window {
    compare: (path1: string, path2: string) => Promise<SsimResult>;
  }
}
