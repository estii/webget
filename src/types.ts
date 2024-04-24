export type { Asset, Cookie, WebgetConfig } from "./schema";

export type ScreenshotOutcome = ScreenshotResult | ScreenshotError;

export type ScreenshotError = {
  status: "error";
  error: string;
};

export type ScreenshotResult = {
  status: "created" | "updated" | "matched";
  path: string;
};
