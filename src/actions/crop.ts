import type { Locator, Page } from "playwright";
import { z } from "zod";

export const cropRectSchema = z.object({
  type: z.literal("rect"),
  x: z.union([z.number(), z.enum(["left", "center", "right"])]).default(0),
  y: z.union([z.number(), z.enum(["top", "center", "bottom"])]).default(0),
  width: z.optional(z.number()),
  height: z.optional(z.number()),
});

export const cropElementSchema = z.object({
  type: z.literal("element"),
  selector: z.string(),
  padding: z.number().default(0),
});

export const cropAreaSchema = z.discriminatedUnion("type", [
  cropRectSchema,
  cropElementSchema,
]);

export const cropActionSchema = z.object({
  type: z.literal("crop"),
  selector: z.optional(z.string()),
  area: z.optional(cropAreaSchema),
});

export type CropAction = z.infer<typeof cropActionSchema>;

export type CropResult = {
  target: Page | Locator;
  rect?: { x: number; y: number; width: number; height: number };
};

const align = {
  left: 0,
  center: 0.5,
  right: 1,
  top: 0,
  middle: 0.5,
  bottom: 1,
} as const;

export async function cropAction(
  page: Page,
  action: CropAction
): Promise<CropResult> {
  let target: Page | Locator = page;
  let size = page.viewportSize();

  if (!size) {
    throw new Error(`viewport size not found`);
  }

  if (action.selector) {
    target = page.locator(action.selector);
    size = await target.boundingBox();
    if (!size) {
      throw new Error(`bounding box not found`);
    }
  }

  if (!action.area) {
    return { target };
  }

  if (action.area.type === "element") {
    const element = target.locator(action.area.selector);
    const bounds = await element.boundingBox();
    if (!bounds) {
      throw new Error(`selector "${action.area.selector}" not found`);
    }

    const rect = {
      x: bounds.x - action.area.padding,
      y: bounds.y - action.area.padding,
      width: bounds.width + action.area.padding * 2,
      height: bounds.height + action.area.padding * 2,
    };

    return { target, rect };
  }

  const width = action.area.width ?? size.width;
  const height = action.area.height ?? size.height;

  const x =
    typeof action.area.x === "number"
      ? action.area.x
      : align[action.area.x] * (size.width - width);

  const y =
    typeof action.area.y === "number"
      ? action.area.y
      : align[action.area.y] * (size.height - height);

  const rect = { x, y, width, height };

  return { target, rect };
}
