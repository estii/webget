import staticPlugin from "@elysiajs/static";
import { Elysia, t } from "elysia";
import os from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
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

let headedBrowser: Promise<Browser> | null = null;
function getHeadedBrowser() {
  if (headedBrowser === null) {
    headedBrowser = chromium.launch({ headless: false, channel });
  }
  return headedBrowser;
}

let headlessBrowser: Promise<Browser> | null = null;
function getHeadlessBrowser() {
  if (headlessBrowser === null) {
    headlessBrowser = chromium.launch({ headless: true, channel });
  }
  return headlessBrowser;
}

let runtime: Promise<Page> | null = null;
function getRuntime() {
  if (runtime === null) {
    runtime = getHeadlessBrowser().then(async (browser) => {
      const page = await browser.newPage();
      const script = await getScript();
      await page.addInitScript({ content: script });
      await page.goto(SERVER_URL);
      page.on("console", (msg) => console.log(msg.type(), msg.text()));
      page.on("pageerror", (msg) => console.log("runtime", msg));
      return page;
    });
  }
  return runtime;
}

async function getBrowser(options: Options) {
  if (options.headless) {
    return getHeadlessBrowser();
  }
  return getHeadedBrowser();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

type Options = {
  headless: boolean;
  diff: boolean;
};

export type ScreenshotResult = {
  status: "created" | "updated" | "matched" | "error";
  error?: string;
};

async function getAssetContext(options: Options, asset: Asset) {
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
  context[Symbol.asyncDispose] = () => context.close();
  return context;
}

async function updateOrError(
  options: Options,
  path: string
): Promise<ScreenshotResult> {
  try {
    return await update(options, path);
  } catch (error) {
    return { status: "error", error: getErrorMessage(error) };
  }
}

async function update(
  options: Options,
  path: string
): Promise<ScreenshotResult> {
  const asset = await getAsset(path);
  await using context = await getAssetContext(options, asset);

  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(10000);
  
  const temp = join(os.tmpdir(), asset.output);
  let crop: CropResult = { target: page };

  await page.goto(asset.url);

  for (const action of asset.actions) {
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

  const exists = await Bun.file(asset.output).exists();

  if (asset.template) {
    const browser = await getBrowser(options);
    const template = await browser.newPage({
      deviceScaleFactor: 3,
    });

    const url = new URL(`${SERVER_URL}/public/templates/${asset.template}`);
    url.searchParams.set("url", asset.url);
    await template.goto(url.href);

    const frame = template.locator("#frame");
    const content = template.locator("#frame .content");

    const frameRect = await frame.boundingBox();
    if (!frameRect) {
      throw new Error("Invalid template");
    }

    await template.setViewportSize({
      width: asset.width ?? 1280,
      height: asset.height ?? 720,
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
      type: asset.type,
      quality: asset.type === "jpeg" ? asset.quality : undefined,
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
      type: asset.type,
      quality: asset.type === "jpeg" ? asset.quality : undefined,
      clip: crop.rect,
    });
  }

  if (exists && options.diff) {
    const result = await compare({ path1: asset.output, path2: temp });

    const matched = result.ssim > 0.99;
    if (!matched) {
      await Bun.write(asset.output, Bun.file(temp));
    }

    return {
      status: matched ? "matched" : "updated",
      error: matched
        ? undefined
        : `similarity ${Math.round(result.ssim * 100)}%`,
    };
  } else {
    await Bun.write(asset.output, Bun.file(temp));
  }

  return { status: "created" };
}

const app = new Elysia()
  .onResponse(async ({ path }) => {
    if (path === "/stop") {
      console.log("Shutting down...");
      await new Promise((resolve) => setTimeout(resolve, 100));
      process.exit(0);
    }
  })
  .get("/stop", async () => {
    if (headedBrowser) {
      await headedBrowser.then((browser) => browser.close());
    }
    if (headlessBrowser) {
      await headlessBrowser.then((browser) => browser.close());
    }
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

async function compare(params: CompareParams) {
  const page = await getRuntime();
  return page.evaluate((params) => window.compare(params), params);
}

declare global {
  interface Window {
    compare: (params: CompareParams) => Promise<CompareResult>;
  }
}
