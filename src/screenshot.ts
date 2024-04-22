import { customAlphabet } from "nanoid";
import { join } from "node:path";
import { PuppeteerSession } from "./browser/puppeteer";
import { getHome } from "./cli";
import { SERVER_URL } from "./constants";
import { type Asset, type AssetConfig } from "./schema";

export type ScreenshotOutcome = ScreenshotResult | ScreenshotError;

export type ScreenshotError = {
  status: "error";
  error: string;
};

export type ScreenshotResult = {
  status: "created" | "updated" | "matched";
  path: string;
};

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const getId = customAlphabet(alphabet, 8);

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

export async function update(asset: Asset): Promise<ScreenshotOutcome> {
  try {
    return await doUpdate(asset);
  } catch (error) {
    return { status: "error", error: getErrorMessage(error) };
  }
}

export async function doUpdate(asset: AssetConfig): Promise<ScreenshotOutcome> {
  const url = new URL(
    asset.url.replace("template://", SERVER_URL + "/public/templates/")
  );

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

  await using session = await PuppeteerSession.getSession(asset);

  console.log(url.href);
  await session.goto({ url: url.href });
  for (const action of asset.actions ?? []) {
    await session.doAction(action);
  }

  const image = await session.screenshot(asset);
  const id = getId();
  const file = `assets/${id}.${asset.type === "jpeg" ? "jpg" : "png"}`;
  await Bun.write(join(getHome(), file), image);

  return {
    status: "created",
    path: `${SERVER_URL}/${file}`,
  };
}
