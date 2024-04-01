import type { Locator, Page } from "playwright";
import { z } from "zod";

export const scrollActionSchema = z
  .object({
    type: z.literal("scroll"),
    selector: z.string(),
    offset: z.number().default(0),
  })
  .strict();

export type ScrollAction = z.infer<typeof scrollActionSchema>;

export async function scrollAction(page: Page, action: ScrollAction) {
  await scrollTo(page.locator(action.selector), action.offset);
}

export async function scrollTo(locator: Locator, top: number = 0) {
  await locator.waitFor({ state: "attached" });
  const bounds = await locator.boundingBox();
  if (!bounds) {
    throw new Error(`Cannot get boundingBox from loc "${locator}"`);
  }
  await locator.evaluate((node: HTMLElement, top: number) => {
    const getScrollParent = (node: null | HTMLElement): HTMLElement => {
      const isElement = node instanceof HTMLElement;
      const overflowY = isElement && window.getComputedStyle(node).overflowY;
      const isScrollable = overflowY !== "visible" && overflowY !== "hidden";
      if (!node) {
        return document.body;
      } else if (isScrollable && node.scrollHeight >= node.clientHeight) {
        return node as HTMLElement;
      }
      return getScrollParent(node.parentNode as null | HTMLElement);
    };
    const scrollParent = getScrollParent(node);

    scrollParent.scrollTop = node.offsetTop - scrollParent.offsetTop - top;
  }, top);
}

export async function getMaxScrollPosition(locator: Locator) {
  return await locator.evaluate((node: HTMLElement) => {
    const getScrollParent = (node: HTMLElement): HTMLElement => {
      const isElement = node instanceof HTMLElement;
      const overflowY = isElement && window.getComputedStyle(node).overflowY;
      const isScrollable = overflowY === "scroll" || overflowY === "auto";
      if (!node) {
        return document.body;
      } else if (isScrollable && node.scrollHeight > node.clientHeight) {
        return node as HTMLElement;
      }
      return getScrollParent(node.parentNode as HTMLElement);
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
  });
}
