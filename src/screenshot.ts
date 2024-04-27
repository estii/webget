import { join } from "node:path";
import { Browser, launch } from "puppeteer";
import { PuppeteerSession, getAssetUrl } from "./browser/puppeteer";
import { getHome } from "./cli";
import { SERVER_URL } from "./constants";
import { type Asset } from "./schema";
import type { ScreenshotOutcome } from "./types";
import { getErrorMessage, getId } from "./utils";

let headedBrowser: Browser | null = null;
let headlessBrowser: Browser | null = null;

export async function getBrowser(headed = false) {
  if (headed) {
    if (!headedBrowser) {
      headedBrowser = await launch({
        headless: false,
        defaultViewport: null,
        waitForInitialPage: false,
        args: ["--no-startup-window"],
      });

      process.on("SIGINT", () => {
        if (headedBrowser) {
          console.log("SIGINT");
          headedBrowser.close().then(() => {
            console.log("closed headed browser");
          });
        }
      });
    }
    return headedBrowser;
  }
  if (!headlessBrowser) {
    headlessBrowser = await launch({
      headless: true,
      defaultViewport: null,
      waitForInitialPage: false,
      args: ["--no-startup-window"],
    });
    process.on("SIGINT", () => {
      console.log("SIGINT");
      if (headlessBrowser) {
        headlessBrowser.close();
      }
    });
  }
  return headlessBrowser;
}

export async function update(asset: Asset): Promise<ScreenshotOutcome> {
  try {
    return await doUpdate(asset);
  } catch (error) {
    return { status: "error", error: getErrorMessage(error) };
  }
}

export async function doUpdate(asset: Asset): Promise<ScreenshotOutcome> {
  const url = new URL(getAssetUrl(asset, asset.url));

  if (asset.inputs) {
    const entries = await Promise.all(
      Object.entries(asset.inputs).map(([key, value]) => {
        return new Promise<[string, ScreenshotOutcome]>(
          async (resolve, reject) => {
            const result = await doUpdate(value);
            resolve([key, result]);
          }
        );
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

  const browser = await getBrowser(asset.headed);
  const page = await browser.newPage();

  try {
    const session = new PuppeteerSession(page, asset);
    await session.init();

    console.log(url.href);
    await session.goto({ url: url.href });
    for (const action of asset.actions ?? []) {
      await session.doAction(action);
    }

    const image = await session.screenshot(asset);
    await page.close();

    const id = getId();
    const file = `screenshots/${id}.${asset.type === "jpeg" ? "jpg" : "png"}`;
    await Bun.write(join(getHome(), file), image);

    return {
      status: "created",
      path: `${SERVER_URL}/${file}`,
    };
  } catch (error) {
    await page.close();
    return { status: "error", error: getErrorMessage(error) };
  }
}
