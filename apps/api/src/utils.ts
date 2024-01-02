import { Locator } from "playwright-core";
import {
  ActionContext,
  ActionOptions,
  Placement,
  Point,
  Rect,
} from "./lib/action";

export const parsePlacement = (placement: Placement) => {
  const [first, second] = placement.split("-");

  let other = 0.5;
  if (second) {
    other = second === "start" ? 0 : 1;
  }

  switch (first) {
    case "left":
      return [0, other];
    case "right":
      return [1, other];
    case "top":
      return [other, 0];
    case "bottom":
      return [other, 1];
  }
  return [0.5, 0.5];
};

export const FRAME_DURATION = 18;
export const CLICK_DURATION = 150;
export const PAUSE_DURATION = 300;
export const SCROLL_PADDING = 100;

export type ActionProps = {
  loc: Locator;
  options?: Partial<ActionOptions>;
  delayAfter?: number;
};

export const toProps = (
  loc: Locator,
  options: Partial<ActionOptions> = {},
  delayAfter: number = 0
) => {
  return { loc, options, delayAfter };
};

const isNumberOffset = (
  value: number | Partial<Point> = 0
): value is number => {
  return !isNaN(value as number);
};

const toOffset = (
  value?: number | Partial<Point>,
  scale: number = 1
): Point => {
  if (isNumberOffset(value)) {
    return { x: value * scale, y: value * scale };
  } else {
    return { x: (value!.x ?? 0) * scale, y: (value!.y ?? 0) * scale };
  }
};

export const getTargetPosition = async (
  ctx: ActionContext,
  loc: Locator,
  options: Partial<ActionOptions> = {},
  relative?: boolean
): Promise<Point> => {
  let { placement = "auto", offsetX, offsetY } = options;

  let offset = toOffset(options.offset ?? { x: offsetX ?? 0, y: offsetY ?? 0 });

  await loc.waitFor({ state: "attached" });

  let box: Rect | null = await loc.boundingBox();
  if (!box) {
    throw new Error(`Cannot get boundingBox from loc "${loc}"`);
  }

  const { x: zoomX, y: zoomY, z } = ctx.output.zoom;
  const [posX, posY] = parsePlacement(placement);

  offset = toOffset(offset);

  let x = !!relative ? 0 : box.x;
  let y = !!relative ? 0 : box.y;

  x = x + posX * box.width + offset.x;
  y = y + posY * box.height + offset.y;

  if (!!relative) {
    x = x;
    y = y;
  } else {
    x = x / z + zoomX;
    y = y / z + zoomY;
  }

  x = Math.round(x);
  y = Math.round(y);

  return { x, y };
};

export const globalToLocal = async (
  loc: Locator,
  pos: Point
): Promise<Point> => {
  const box = await loc.boundingBox();
  if (!box) {
    throw new Error(`Cannot get boundingBox from loc "${loc}"`);
  }

  return {
    x: pos.x - box.x,
    y: pos.y - box.y,
  };
};

export const localToGlobal = async (
  loc: Locator,
  pos: Point
): Promise<Point> => {
  const box = await loc.boundingBox();
  if (!box) {
    throw new Error(`Cannot get boundingBox from loc "${loc}"`);
  }

  return {
    x: box.x + pos.x,
    y: box.y + pos.y,
  };
};

export async function wait(ctx: ActionContext, ms: number) {
  await ctx.page.waitForTimeout(ms);
}
