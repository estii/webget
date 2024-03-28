import staticPlugin from "@elysiajs/static";
import { Elysia, t } from "elysia";
import os from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { clickAction } from "./actions/click";
import { cropAction, type CropResult } from "./actions/crop";
import { fillAction } from "./actions/fill";
import { hoverAction } from "./actions/hover";
import { waitAction } from "./actions/wait";
import type { CompareParams, CompareResult } from "./browser";
import { PORT, SERVER_URL } from "./constants";
import { getAsset, type Asset } from "./schema";
import { getMime } from "./utils";

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

export type ScreenshotResult = {
  status: "created" | "updated" | "matched" | "error";
  error?: string;
};

async function getScreenshot(options: Options, path: string) {
  const asset = await getAsset(path);
  console.log(asset);

  const browser = await getBrowser(options);
  const context = await browser.newContext({
    viewport: { width: asset.width ?? 1280, height: asset.height ?? 720 },
    baseURL: asset.baseUrl,
    deviceScaleFactor: asset.deviceScaleFactor,
    colorScheme: asset.colorScheme,
    reducedMotion: asset.reducedMotion,
    forcedColors: asset.forcedColors,
    storageState: asset.storageState,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(10000);

  const result = await getScreenshotResult(options, page, asset);
  await context.close();
  return result;
}

async function getScreenshotResult(
  options: Options,
  page: Page,
  config: Asset
): Promise<ScreenshotResult> {
  try {
    return await updateScreenshot(options, page, config);
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", error: error.message };
    }
    return { status: "error", error: "Unknown error" };
  }
}

async function updateScreenshot(
  options: Options,
  page: Page,
  config: Asset
): Promise<ScreenshotResult> {
  const output = config.output;
  const temp = join(os.tmpdir(), config.output);
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

  const exists = await Bun.file(config.output).exists();

  if (config.template) {
    const browser = await getBrowser(options);
    const template = await browser.newPage({
      deviceScaleFactor: 3, //config.template.includes("iPhone15Pro") ? 3 : 2,
    });

    const url = new URL(`${SERVER_URL}/public/templates/${config.template}`);
    url.searchParams.set("url", config.url);
    await template.goto(url.href);

    const frame = template.locator("#frame");
    const content = template.locator("#frame .content");

    const frameRect = await frame.boundingBox();
    if (!frameRect) {
      throw new Error("Invalid template");
    }

    await template.setViewportSize({
      width: config.width ?? 1280,
      height: config.height ?? 720,
    });

    // await template.setViewportSize({
    //   width: frameRect.width,
    //   height: frameRect.height,
    // });

    const contentRect = await content.boundingBox();
    if (!contentRect) {
      throw new Error("Invalid template");
    }

    // set page to the size of the templates content
    await page.setViewportSize({
      width: contentRect.width,
      height: contentRect.height,
    });

    // take screenshot of the page
    await page.screenshot({
      path: temp,
      type: config.type,
      quality: config.type === "jpeg" ? config.quality : undefined,
    });

    await content.evaluate(
      (el: HTMLImageElement, temp) =>
        (el.style.backgroundImage = `url(http://localhost:3637/image?path=${temp})`),
      temp
    );

    const image = await template.screenshot({ omitBackground: true });
    await Bun.write(temp, image);

    await template.close();
  } else {
    await crop.target.screenshot({
      path: temp,
      type: config.type,
      quality: config.type === "jpeg" ? config.quality : undefined,
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

const app = new Elysia()
  .get(
    "/screenshot",
    async ({ query: { path, headed, diff } }) => {
      return getScreenshot({ headless: !headed, diff }, path);
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
  .get("/stop", async () => {
    await app.stop();
  })
  .use(staticPlugin())
  .listen(PORT);

export type App = typeof app;

async function compare(params: CompareParams) {
  const page = await runtime;
  return page.evaluate((params) => window.compare(params), params);
}

declare global {
  interface Window {
    compare: (params: CompareParams) => Promise<CompareResult>;
  }
}
