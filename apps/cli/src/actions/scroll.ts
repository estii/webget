import { Locator } from "playwright-core";
import {
  ActionContext,
  ActionOptions,
  Rect,
} from "../../../api/src/lib/action";
import { parsePlacement } from "../../../api/src/utils";

type El = HTMLElement | SVGElement;

export const getTargetScroll = async (
  ctx: ActionContext,
  loc: Locator,
  options: Partial<ActionOptions> = {},
  relative?: boolean
) => {
  if (!!relative) {
    return 0;
  }

  let { placement = "auto" } = options;

  await loc.waitFor({ state: "attached" });

  let box: Rect | null = await loc.boundingBox();
  if (!box) {
    throw new Error(`Cannot get boundingBox from loc "${loc}"`);
  }

  let { height } = box;
  const [_, posY] = parsePlacement(placement);

  let scroll = await getScrollOffset(loc);
  return Math.round(scroll + posY * height);
};

const getScrollOffset = async (loc: Locator) => {
  return await loc.evaluate((node: El) => {
    const getScrollParent = (node: El): El => {
      const isElement = node instanceof HTMLElement;
      const overflowY = isElement && window.getComputedStyle(node).overflowY;
      const isScrollable = overflowY !== "visible" && overflowY !== "hidden";
      if (!node) {
        return document.body;
      } else if (isScrollable && node.scrollHeight >= node.clientHeight) {
        return node as HTMLElement;
      }
      return getScrollParent(node.parentNode as El);
    };
    const scrollParent = getScrollParent(node);
    return (
      (node as HTMLElement).offsetTop - (scrollParent as HTMLElement).offsetTop
    );
  });
};
export const scrollToLocator = async (loc: Locator, top: number) => {
  await loc.evaluate((node: El, top: number) => {
    const getScrollParent = (node: El): El => {
      const isElement = node instanceof HTMLElement;
      const overflowY = isElement && window.getComputedStyle(node).overflowY;
      const isScrollable = overflowY !== "visible" && overflowY !== "hidden";
      if (!node) {
        return document.body;
      } else if (isScrollable && node.scrollHeight >= node.clientHeight) {
        return node as HTMLElement;
      }
      return getScrollParent(node.parentNode as El);
    };
    const scrollParent = getScrollParent(node);

    scrollParent.scrollTo({ top, behavior: "smooth" });
  }, top);
};

export const getMaxScrollPosition = async (loc: Locator) => {
  return await loc.evaluate((node: El) => {
    const getScrollParent = (node: El): El => {
      const isElement = node instanceof HTMLElement;
      const overflowY = isElement && window.getComputedStyle(node).overflowY;
      const isScrollable = overflowY !== "visible" && overflowY !== "hidden";
      if (!node) {
        return document.body;
      } else if (isScrollable && node.scrollHeight >= node.clientHeight) {
        return node as HTMLElement;
      }
      return getScrollParent(node.parentNode as El);
    };
    const scrollParent = getScrollParent(node) as HTMLElement;

    const limit = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.body.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight,
      document.documentElement.clientHeight,
      scrollParent.scrollHeight,
      scrollParent.offsetHeight,
      scrollParent.clientHeight
    );

    return Math.max(0, limit - window.innerHeight);
    // return scrollParent.scrollHeight - (node as HTMLElement).clientHeight;
  });
};

export type ScrollParams = {
  selector: string;
  offset?: number;
};

export async function scroll(
  ctx: ActionContext,
  { selector, offset = 0 }: ScrollParams
) {
  const locator = ctx.page.locator(selector);
  await locator.waitFor({ state: "attached" });
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Cannot get boundingBox from selector "${selector}"`);
  }

  await locator.evaluate((node: El, offset: number) => {
    const getScrollParent = (node: null | El): El => {
      const isElement = node instanceof HTMLElement;
      const overflowY = isElement && window.getComputedStyle(node).overflowY;
      const isScrollable = overflowY !== "visible" && overflowY !== "hidden";
      if (!node) {
        return document.body;
      } else if (isScrollable && node.scrollHeight >= node.clientHeight) {
        return node as HTMLElement;
      }
      return getScrollParent(node.parentNode as null | El);
    };
    const scrollParent = getScrollParent(node);

    scrollParent.scrollTop =
      (node as HTMLElement).offsetTop -
      (scrollParent as HTMLElement).offsetTop -
      offset;
  }, offset);

  // globalThis.scrollPos = [0, round(box.y + top, 0.01)];
}
