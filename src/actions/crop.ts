import type { Locator, Page } from "playwright";
import { z } from "zod";
import { getMaxScrollPosition } from "./scroll";

export const cropActionSchema = z
  .object({
    type: z.literal("crop"),
    selector: z.string().optional(),
    x: z.number().default(0),
    y: z.number().default(0),
    width: z.number().default(1),
    height: z.number().default(1),
    padding: z.number().default(0),
    fullPage: z.boolean().default(false),
  })
  .strict();

export type CropAction = z.infer<typeof cropActionSchema>;

export type CropResult = {
  target: Locator;
  rect: { x: number; y: number; width: number; height: number };
  fullPage: boolean;
};

export async function cropAction(
  page: Page,
  action: CropAction
): Promise<CropResult> {
  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error("viewport size is not set");
  }

  const target = action.selector
    ? page.locator(action.selector)
    : page.locator("body");

  if (action.fullPage) {
    const maxScrollPosition = await getMaxScrollPosition(target);
    page.setViewportSize({
      width: viewport.width,
      height: viewport.height + maxScrollPosition,
    });
  }

  const size = await target.boundingBox();
  if (!size) {
    throw new Error(`selector "${action.selector}" not found`);
  }

  // let size = { x: 0, y: 0, width: pageSize.width, height: pageSize.height };
  // if (action.selector) {
  //   // target = page.locator(action.selector);
  //   const bounds = await target.boundingBox();
  //   if (!bounds) {
  //     throw new Error(`selector "${action.selector}" not found`);
  //   }
  //   size = bounds;
  // }

  const width = action.width > 1 ? action.width : size.width * action.width;
  const height =
    action.height > 1 ? action.height : size.height * action.height;
  const x = action.x < 1 ? (size.width - width) * action.x : action.x;
  const y = action.y < 1 ? (size.height - height) * action.y : action.y;
  const rect = {
    x: size.x + x - action.padding,
    y: size.y + y - action.padding,
    width: width + action.padding * 2,
    height: height + action.padding * 2,
  };
  // console.log(size);
  // console.log(action);
  // console.log(rect);

  return { target, rect, fullPage: action.fullPage };
}
