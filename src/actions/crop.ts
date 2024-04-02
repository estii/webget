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

  let { x, y, width, height, padding } = action;

  width = width > 1 ? width : width * size.width;
  height = height > 1 ? height : height * size.height;

  x = x > 1 ? x : x * (size.width - width);
  y = y > 1 ? y : y * (size.height - height);

  x += size.x;
  y += size.y;

  x -= padding;
  y -= padding;

  width += padding * 2;
  height += padding * 2;

  const rect = { x, y, width, height };
  // console.log(action);
  // console.log(size);
  // console.log(rect);
  return { target, rect, fullPage: action.fullPage };
}
