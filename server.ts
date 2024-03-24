import os from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { ZodError } from "zod";
import { clickAction } from "./actions/click";
import { cropAction, type CropResult } from "./actions/crop";
import { fillAction } from "./actions/fill";
import { hoverAction } from "./actions/hover";
import { waitAction } from "./actions/wait";
import type {
  CompareParams,
  CompareResult,
  CompositeParams,
  CompositeResult,
} from "./browser";
import { getConfig, type Config } from "./config";
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

const channel = "chrome";
const headedBrowser = chromium.launch({ headless: false, channel });
const headlessBrowser = chromium.launch({ headless: true, channel });

const runtime = headlessBrowser.then(async (browser) => {
  const page = await browser.newPage();
  const script = await getScript();
  await page.addInitScript({ content: script });
  await page.goto(SERVER_URL);
  page.on("console", (msg) => console.log(msg.type(), msg.text()));
  page.on("pageerror", (msg) => console.log("runtime", msg));
  return page;
});

async function getBrowser(options: Options) {
  if (options.headless) {
    return headlessBrowser;
  }
  return headedBrowser;
}

type Options = {
  headless: boolean;
  diff: boolean;
};

async function getScreenshot(options: Options, path: string) {
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
  const browser = await getBrowser(options);
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height },
    baseURL: config.baseUrl,
    deviceScaleFactor: config.deviceScaleFactor,
    colorScheme: config.colorScheme,
    reducedMotion: config.reducedMotion,
    forcedColors: config.forcedColors,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(2000);
  page.setDefaultNavigationTimeout(10000);

  const result = await getScreenshotResult(options, page, config);

  await page.close();
  await context.close();
  return Response.json(result);
}

async function getScreenshotResult(
  options: Options,
  page: Page,
  config: Config
) {
  try {
    return await updateScreenshot(options, page, config);
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", error: error.message };
    }
    return { status: "error", error: "Unknown error" };
  }
}

async function updateScreenshot(options: Options, page: Page, config: Config) {
  const output = config.path;
  const temp = join(os.tmpdir(), config.path);
  let crop: CropResult = { target: page };

  await page.goto(config.url);

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
  const type = getOutputType(output);

  if (config.device) {
    const browser = await getBrowser(options);
    const template = await browser.newPage({
      deviceScaleFactor: config.device === "iPhone15Pro" ? 3 : 2,
    });

    const url = new URL(SERVER_URL);
    url.searchParams.set("device", config.device);
    await template.goto(url.href, { waitUntil: "networkidle" });

    // measure the size of the .device element
    let device = template.locator("#device");
    const deviceRect = await device.boundingBox();
    if (!deviceRect) {
      throw new Error("No bezel element found");
    }

    await template.setViewportSize({
      width: deviceRect.width,
      height: deviceRect.height,
    });

    const content = template.locator("#device .content");
    const contentRect = await content.boundingBox();
    if (!contentRect) {
      throw new Error("No bezel element found");
    }

    await page.setViewportSize({
      width: contentRect.width,
      height: contentRect.height,
    });

    await page.screenshot({
      path: temp,
      type,
      quality: type === "jpeg" ? config.quality : undefined,
    });

    url.searchParams.set("url", config.url);
    url.searchParams.set("path", temp);
    url.searchParams.set("background", "white");
    await template.goto(url.href, { waitUntil: "networkidle" });

    device = template.locator("#device");
    const image = await device.screenshot({ omitBackground: true });
    await template.close();
    await Bun.write(temp, image);
  } else {
    await crop.target.screenshot({
      path: temp,
      type,
      quality: type === "jpeg" ? config.quality : undefined,
      clip: crop.rect,
    });
  }

  if (exists && options.diff) {
    const result = await compare({ path1: output, path2: temp });

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
  } else {
    await Bun.write(output, Bun.file(temp));
  }

  return { status: "created" };
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/screenshot") {
      const path = url.searchParams.get("path");
      const headless = url.searchParams.get("headed") !== "1";
      const diff = url.searchParams.get("diff") === "1";
      if (!path) {
        console.log("No path");
        return new Response(null, { status: 400 });
      }
      const result = await getScreenshot({ headless, diff }, path);
      return result;
    }

    if (path === "/image" && req.method === "GET") {
      const path = url.searchParams.get("path");
      if (!path) {
        return new Response(null, { status: 400 });
      }
      const mime = getMime(path);
      const file = Bun.file(path);
      return new Response(file, {
        headers: { "Content-Type": mime, "Cache-Control": "no-store" },
      });
    }

    if (path === "/image" && req.method === "POST") {
      const path = url.searchParams.get("path");
      if (!path) {
        return new Response(null, { status: 400 });
      }
      await Bun.write(path, await req.arrayBuffer());
      return new Response(null, { status: 200 });
    }

    const file = path === "/" ? "/index.html" : path;
    const dist = `./templates/dist${file}`;
    return new Response(Bun.file(dist), { status: 200 });
  },
  error() {
    return new Response(null, { status: 404 });
  },
});

async function compare(params: CompareParams) {
  const page = await runtime;
  return page.evaluate((params) => window.compare(params), params);
}

async function composite(params: CompositeParams) {
  const page = await runtime;
  return page.evaluate((params) => window.composite(params), params);
}

declare global {
  interface Window {
    compare: (params: CompareParams) => Promise<CompareResult>;
    composite: (params: CompositeParams) => Promise<CompositeResult>;
  }
}
