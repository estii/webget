import {
  ElementHandle,
  launch,
  type Browser,
  type BrowserContext,
  type Frame,
  type Page,
} from "puppeteer";
import type {
  Action,
  Asset,
  AssetConfig,
  ClickAction,
  CropParams,
  FillParams,
  GotoParams,
  HoverParams,
  ScrollParams,
  WaitAction,
} from "../schema";

let headedBrowser: Promise<Browser> | null = null;
function getHeadedBrowser() {
  if (headedBrowser === null) {
    headedBrowser = launch({ headless: false });
  }
  return headedBrowser;
}

let headlessBrowser: Promise<Browser> | null = null;
function getHeadlessBrowser() {
  if (headlessBrowser === null) {
    headlessBrowser = launch({ headless: true });
  }
  return headlessBrowser;
}

export async function getBrowser(headed = false) {
  if (headed) {
    return getHeadedBrowser();
  }
  return getHeadlessBrowser();
}

type Crop = {
  rect: { x: number; y: number; width: number; height: number };
  fullPage: boolean;
};

export class PuppeteerSession {
  static async getSession(asset: AssetConfig) {
    const browser = await getBrowser(asset.headed);
    const context = await browser.createBrowserContext({
      // baseURL: asset?.baseUrl,
    });

    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(10000);

    await page.setViewport({
      width: asset?.width ?? 1280,
      height: asset?.height ?? 720,
      deviceScaleFactor: asset?.deviceScaleFactor,
    });

    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: asset?.colorScheme ?? "light" },
      {
        name: "prefers-reduced-motion",
        value: asset?.reducedMotion ?? "no-preference",
      },
      // not supported in puppeteer
      // { name: "forced-colors", value: asset?.forcedColors ?? "none" },
    ]);

    if (asset?.storageState?.cookies) {
      await page.setCookie(...asset.storageState.cookies);
    }

    if (asset?.storageState?.origins) {
      await page.evaluateOnNewDocument((origins) => {
        for (const origin of origins) {
          for (const entry of origin.localStorage) {
            localStorage.setItem(entry.name, entry.value);
          }
        }
      }, asset.storageState.origins);
    }

    return new PuppeteerSession(context, page, asset);
  }

  private _crop: Crop;

  [Symbol.asyncDispose] = () => {
    return this.context.close();
  };

  constructor(
    public readonly context: BrowserContext,
    public readonly page: Page,
    public readonly asset: AssetConfig
  ) {
    const size = page.viewport();
    this._crop = {
      rect: {
        x: 0,
        y: 0,
        width: size?.width ?? 1280,
        height: size?.height ?? 720,
      },
      fullPage: false,
    };
  }

  async goto({ url }: GotoParams) {
    await this.page.goto(url, { waitUntil: "load" });
  }

  async click({
    frameSelector,
    selector,
    clickCount,
    button,
    position,
  }: ClickAction) {
    let target: Page | Frame = this.page;

    if (frameSelector) {
      const frame = await this.page.waitForFrame(frameSelector);
      if (!frame) {
        throw new Error(`frame "${frameSelector}" not found`);
      }
      target = frame;
    }

    try {
      await target.locator(selector).click({
        clickCount,
        button,
        offset: position,
      });
    } catch (error) {
      throw new Error(`selector "${selector}" not found`);
    }

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

    this._crop = {
      rect: { x, y, width, height },
      fullPage: params.fullPage ?? false,
    };
  }

  async fill({ selector, text }: FillParams) {
    await this.page.locator(selector).fill(text);
  }

  async hover({ selector }: HoverParams) {
    await this.page.locator(selector).hover();
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
        this._crop.rect
      );
    }
    return this.page.screenshot({
      type: params.type,
      quality: params.type === "jpeg" ? params.quality : undefined,
      clip: this._crop.rect,
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
