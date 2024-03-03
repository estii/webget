import os from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { ZodError } from "zod";
import { clickAction } from "./actions/click";
import { cropAction, type CropResult } from "./actions/crop";
import { fillAction } from "./actions/fill";
import { hoverAction } from "./actions/hover";
import { waitAction } from "./actions/wait";
import type { SsimResult } from "./browser";
import { Config, getConfig } from "./config";
import { PORT, SERVER_URL } from "./constants";
import { getMime, getOutputType } from "./utils";

async function getScript() {
  const output = await Bun.build({
    entrypoints: ["browser.ts"],
    target: "browser",
  });

  const [script] = output.outputs;
  if (script) return script.text();
  console.log(output.logs);
  throw new Error("No script found");
}

const headedBrowser = chromium.launch({ headless: false });
const headlessBrowser = chromium.launch({ headless: true });

const runtime = headlessBrowser.then(async (browser) => {
  const page = await browser.newPage();
  const script = await getScript();
  await page.addInitScript({ content: script });
  await page.goto(SERVER_URL);
  page.on("console", (msg) => console.log(msg.type(), msg.text()));
  page.on("pageerror", (msg) => console.log("runtime", msg));
  return page;
});

async function getBrowser(headless = true) {
  if (headless) {
    return headlessBrowser;
  }
  return headedBrowser;
}

async function getScreenshot(path: string, headless: boolean) {
  let config: Config;
  try {
    config = await getConfig(path);
  } catch (error) {
    if (error instanceof ZodError) {
      const [first] = error.issues;
      if (first) {
        return Response.json({ status: "error", error: first.message });
      }
    }
    return Response.json({ status: "error", error: String(error) });
  }
  const browser = await getBrowser(headless);
  const context = await browser.newContext({
    screen: { width: config.width, height: config.height },
    baseURL: config.baseUrl,
    deviceScaleFactor: config.deviceScaleFactor,
    colorScheme: config.colorScheme,
    reducedMotion: config.reducedMotion,
    forcedColors: config.forcedColors,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(2000);
  page.setDefaultNavigationTimeout(10000);

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
  const temp = join(os.tmpdir(), config.path);
  let crop: CropResult = { target: page };

  await page.goto(config.url, { waitUntil: "networkidle" });

  for (const action of config.actions) {
    if (action.type === "click") {
      await clickAction(page, action);
    } else if (action.type === "crop") {
      crop = await cropAction(page, action);
    } else if (action.type === "wait") {
      await waitAction(page, action);
    } else if (action.type === "fill") {
      await fillAction(page, action);
    } else if (action.type === "hover") {
      await hoverAction(page, action);
    }
  }

  const exists = await Bun.file(output).exists();
  const path = exists ? temp : output;
  const type = getOutputType(output);

  await crop.target.screenshot({
    path,
    type,
    quality: type === "jpeg" ? config.quality : undefined,
    clip: crop.rect,
  });

  if (exists) {
    const result = await compareImages(output, temp);

    const matched = result.ssim > 0.99;
    if (!matched) {
      await Bun.write(output, Bun.file(temp));
    }

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

    if (path === "/diff") {
      const path = url.searchParams.get("path");
      if (!path) {
        return new Response(null, { status: 400 });
      }
      await Bun.write(path, await req.arrayBuffer());
      return new Response(null, { status: 200 });
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
