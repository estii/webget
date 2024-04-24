import { type ElementHandle, type Page } from "puppeteer";
import type {
  Action,
  Asset,
  ClickAction,
  CropParams,
  FillParams,
  GotoParams,
  HoverParams,
  ScrollParams,
  WaitAction,
} from "../schema";

type Rect = { x: number; y: number; width: number; height: number };

export class PuppeteerSession {
  private _clip: Rect;

  constructor(
    public readonly page: Page,
    public readonly asset: Asset
  ) {
    this._clip = {
      x: 0,
      y: 0,
      width: asset.width ?? 1280,
      height: asset.height ?? 720,
    };
  }

  async init() {
    const page = this.page;
    const asset = this.asset;

    await this.page.setViewport({
      width: asset.width ?? 1280,
      height: asset.height ?? 720,
      deviceScaleFactor: asset.deviceScaleFactor,
    });

    await this.page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: asset.colorScheme ?? "light" },
      {
        name: "prefers-reduced-motion",
        value: asset.reducedMotion ?? "no-preference",
      },
      // not supported in puppeteer
      // { name: "forced-colors", value: asset?.forcedColors ?? "none" },
    ]);

    if (asset.storageState?.cookies) {
      await page.setCookie(...asset.storageState.cookies);
    }

    if (asset.storageState?.origins) {
      await page.evaluateOnNewDocument((origins) => {
        for (const origin of origins) {
          for (const entry of origin.localStorage) {
            localStorage.setItem(entry.name, entry.value);
          }
        }
      }, asset.storageState.origins);
    }
  }

  async goto({ url, waitUntil = "domcontentloaded" }: GotoParams) {
    await this.page.goto(url, { waitUntil });
  }

  async click({
    frameSelector,
    selector,
    clickCount,
    button,
    position,
  }: ClickAction) {
    await this.page.click(selector, { clickCount, button });
    await this.page.mouse.move(0, 0);
  }

  async getMaxScrollPosition(handle: ElementHandle<Element>) {
    return await handle.evaluate((node: Element) => {
      const getScrollParent = (node: Element): HTMLElement => {
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

  async crop(params: CropParams) {
    const viewport = this.page.viewport();
    if (!viewport) {
      throw new Error("viewport size is not set");
    }

    const selector = params.selector ?? "body";
    const target = await this.page.$(selector);
    if (!target) {
      throw new Error(`selector "${params.selector}" not found`);
    }

    if (params.fullPage) {
      const maxScrollPosition = await this.getMaxScrollPosition(target);
      this.page.setViewport({
        width: viewport.width,
        height: viewport.height + maxScrollPosition,
      });
    }

    const size = await target.boundingBox();
    if (!size) {
      throw new Error(`selector "${params.selector}" not found`);
    }

    let { x = 0, y = 0, width = 1, height = 1, padding = 0 } = params;

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

    this._clip = { x, y, width, height };
  }

  async fill({ selector, text }: FillParams) {
    await this.page.type(selector, text);
  }

  async hover({ selector }: HoverParams) {
    await this.page.hover(selector);
  }

  async scroll(params: ScrollParams) {
    const handle = await this.page.$(params.selector);
    if (!handle) {
      throw new Error(`Cannot find selector "${params.selector}"`);
    }
    // await locator.waitFor({ state: "attached" });
    const bounds = await handle.boundingBox();
    if (!bounds) {
      throw new Error(`Cannot get boundingBox from loc "${handle}"`);
    }
    await handle.evaluate((node: Element, top: number) => {
      const isElement = node instanceof HTMLElement;
      if (!isElement) return;

      const getScrollParent = (node: null | Element): HTMLElement => {
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
    }, params.offset ?? 0);
  }

  async wait(action: WaitAction) {
    await new Promise((resolve) => setTimeout(resolve, action.milliseconds));
  }

  doAction(action: Action) {
    switch (action.type) {
      case "click":
        return this.click(action);
      case "crop":
        return this.crop(action);
      case "fill":
        return this.fill(action);
      case "hover":
        return this.hover(action);
      case "scroll":
        return this.scroll(action);
      case "wait":
        return this.wait(action);
    }
  }

  async screenshot(
    params: Pick<Asset, "type" | "omitBackground" | "quality" | "border">
  ) {
    if (params.border) {
      await this.page.evaluate(
        (border, rect) => {
          const div = document.createElement("div");
          document.body.appendChild(div);

          div.style.boxSizing = "border-box";
          div.style.position = "fixed";
          div.style.top = rect.y + "px";
          div.style.left = rect.x + "px";
          div.style.width = rect.width + "px";
          div.style.height = rect.height + "px";
          div.style.border = border;
          div.style.zIndex = "10000";
        },
        params.border,
        this._clip
      );
    }
    return this.page.screenshot({
      type: params.type,
      quality: params.type === "jpeg" ? params.quality : undefined,
      clip: this._clip,
      // animations: "disabled",
      omitBackground: params.omitBackground,
    });
  }

  setViewportSize({ width, height }: { width: number; height: number }) {
    return this.page.setViewport({ width, height });
  }

  async getBoundingBox(selector: string) {
    const handle = await this.page.$(selector);
    if (!handle) {
      throw new Error(`Cannot find selector "${selector}"`);
    }
    return handle.boundingBox();
  }
}
