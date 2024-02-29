import { unlink } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import type { SsimResult } from "./browser";
import { Config } from "./config";
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

async function getConfig(path: string) {
  const json = await Bun.file(path + ".json").json();
  return { path, ...Config.parse(json) };
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

async function findConfig(path: string) {
  const dir = dirname(path);
  if (dir === "/") {
    return null;
  }

  const file = Bun.file(join(dir, "webget.json"));
  if (await file.exists()) {
    return Config.parse(file.json());
  }

  return findConfig(dir);
}

let browser: Browser | null = null;

async function getBrowser() {
  if (browser) {
    return browser;
  }

  browser = await chromium.launch({ headless: true, channel: "chrome" });
  return browser;
}

let runtime: Page | null = null;

async function getRuntime() {
  if (runtime) {
    return runtime;
  }

  const browser = await getBrowser();
  runtime = await browser.newPage();
  const script = await getScript();
  await runtime.addInitScript({ content: script });
  await runtime.goto(SERVER_URL);

  return runtime;
}

async function getScreenshot(path: string) {
  const config = await getConfig(path);
  const browser = await getBrowser();
  const context = await browser.newContext({
    screen: { width: config.width, height: config.height },
    deviceScaleFactor: config.deviceScaleFactor,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(1000);
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

async function updateScreenshot(page: Page, config: Config) {
  const output = config.path;
  const temp = join(os.tmpdir(), output);

  await page.goto(config.url);

  for (const action of config.actions) {
    if (action.type === "click") {
      try {
        if (action.frame) {
          const frame = page.frame({ name: action.frame });
          if (!frame) throw new Error(`Frame ${action.frame} not found`);
          await frame.locator(action.selector).click();
        } else {
          await page.locator(action.selector).click();
        }
      } catch (error) {
        throw new Error(`Selector ${action.selector} not found`);
      }
    }
  }

  const exists = await Bun.file(output).exists();
  const path = exists ? temp : output;
  const type = getType(output);
  await page.screenshot({ path, type });

  if (exists) {
    const runtime = await getRuntime();
    const result = await runtime.evaluate(
      ({ path1, path2 }) => {
        return window.compare(path1, path2);
      },
      {
        path1: output,
        path2: temp,
      }
    );

    const matched = result.ssim > 0.95;
    if (!matched) {
      await Bun.write(output, Bun.file(temp));
    }
    await unlink(temp);

    return { status: matched ? "matched" : "updated" };
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
      if (!path) {
        console.log("No path");
        return new Response(null, { status: 400 });
      }
      const result = await getScreenshot(path);
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

declare global {
  interface Window {
    compare: (path1: string, path2: string) => Promise<SsimResult>;
  }
}
