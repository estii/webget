import type { BrowserContext } from "playwright";
import type { Config } from "./config";

export type WebgetConfig = {
  setup(context: BrowserContext, config: Config): Promise<void>;
};
