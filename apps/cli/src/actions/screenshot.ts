import fs from "fs";
import { LocatorScreenshotOptions } from "playwright";
// import ssim from "ssim.js";
import { ActionContext, Rect } from "../../../api/src/lib/action";
import { logComplete, logStart } from "../api";
// import { getImageData } from "../ssim";
import { getMaxScrollPosition } from "./scroll";
import { set } from "./set";

export type ScreenshotParams = {
  template?: string;
  fullPage?: boolean;
  padding?: number;
  crop?:
    | string
    | {
        x?: number | "left" | "center" | "right";
        y?: number | "top" | "center" | "bottom";
        width?: number;
        height?: number;
      };
} & LocatorScreenshotOptions;

function getX(
  viewportWidth: number,
  width?: number,
  position?: "left" | "center" | "right" | number
) {
  switch (position) {
    case "left":
      return 0;
    case "center":
      return (viewportWidth - (width ?? viewportWidth)) / 2;
    case "right":
      return viewportWidth - (width ?? viewportWidth);
    default:
      return position ?? 0;
  }
}

function getY(
  viewportHeight: number,
  height?: number,
  position?: "top" | "center" | "bottom" | number
) {
  switch (position) {
    case "top":
      return 0;
    case "center":
      return (viewportHeight - (height ?? viewportHeight)) / 2;
    case "bottom":
      return viewportHeight - (height ?? viewportHeight);
    default:
      return position ?? 0;
  }
}

export async function screenshot(ctx: ActionContext, action: ScreenshotParams) {
  const { output, page } = ctx;
  if (output.type === "webm") {
    throw new Error("Crop not supported for video");
  }

  const start = logStart("screenshot", output.path);

  const locator =
    typeof action.crop === "string"
      ? page.locator(action.crop)
      : page.locator("body");

  if (action.fullPage) {
    const height = output.height + (await getMaxScrollPosition(locator));
    await page.setViewportSize({ width: output.width, height });
  }

  let clip: Rect | undefined;
  if (typeof action.crop === "string") {
    clip = (await locator.boundingBox()) ?? undefined;
  } else if (action.crop) {
    clip = {
      x: getX(output.width, action.crop?.width, action.crop?.x),
      y: getY(output.height, action.crop?.height, action.crop?.y),
      width: action.crop?.width ?? output.width,
      height: action.crop?.height ?? output.height,
    };
  }

  const { padding = 0 } = action;
  if (clip && padding) {
    clip = {
      x: clip.x - padding,
      y: clip.y - padding,
      width: clip.width + padding * 2,
      height: clip.height + padding * 2,
    };
  }

  await set(ctx, { clip });

  const buffer = await page.screenshot({ ...action, clip });
  fs.writeFileSync(output.path, buffer);

  // const img1 = await getImageData(output.path);
  // const img2 = await getImageData(buffer);
  // const { mssim, performance } = ssim(img1, img2);
  // console.log("SSIM", mssim, performance);

  if (action.template) {
    // convert buffer to base64 data url
    const data = buffer.toString("base64");
    const src = `data:image/png;base64,${data}`;
    await set(ctx, { template: { type: "cover", src } });

    const template = await page.locator("#template");
    const processed = await template.screenshot();
    fs.writeFileSync(output.path, processed);
  }

  await page.setViewportSize(output);
  logComplete(start);
}
