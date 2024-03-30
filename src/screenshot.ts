import os from "node:os";
import { join } from "node:path";
import { clickAction } from "./actions/click";
import { cropAction, type CropResult } from "./actions/crop";
import { fillAction } from "./actions/fill";
import { hoverAction } from "./actions/hover";
import { waitAction } from "./actions/wait";
import { getBrowser } from "./browser";
import { SERVER_URL } from "./constants";
import { compare } from "./runtime";
import { getAsset, type Asset } from "./schema";

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
  const browser = await getBrowser(options.headless);
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

export async function updateOrError(
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
    const browser = await getBrowser(options.headless);
    const template = await browser.newPage({
      deviceScaleFactor: asset.deviceScaleFactor,
    });

    // take screenshot of the page
    await page.screenshot({
      path: temp,
      type: asset.type,
      quality: asset.type === "jpeg" ? asset.quality : undefined,
    });

    const url = new URL(`${SERVER_URL}/public/templates/${asset.template}`);
    const src = `http://localhost:3637/image?path=${temp}`;
    url.searchParams.set("url", asset.url);
    url.searchParams.set("src", src);
    await template.goto(url.href);

    const bounds = await template.locator("#bounds").boundingBox();
    if (bounds) {
      console.log(bounds);
      await template.setViewportSize({
        width: bounds.width,
        height: bounds.height,
      });
    }

    // await template.setViewportSize({
    //   width: asset.width ?? 1280,
    //   height: asset.height ?? 720,
    // });

    // await template.setViewportSize({
    //   width: bounds.width,
    //   height: bounds.height,
    // });

    // const contentRect = await content.boundingBox();
    // if (!contentRect) {
    //   throw new Error("Invalid template");
    // }

    // set page to the size of the templates content
    // await page.setViewportSize({
    //   width: contentRect.width,
    //   height: contentRect.height,
    // });

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
