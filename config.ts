import { dirname, join } from "node:path";
import { z } from "zod";
import { ClickAction } from "./actions/click";
import { CropAction } from "./actions/crop";
import { FillAction } from "./actions/fill";
import { HoverAction } from "./actions/hover";
import { WaitAction } from "./actions/wait";

export const Action = z.discriminatedUnion("type", [
  ClickAction,
  HoverAction,
  FillAction,
  WaitAction,
  CropAction,
]);

export type Action = z.infer<typeof Action>;

const deviceTypeSchema = z.enum([
  "iMac24",
  "iMac27",
  "iPadPro11",
  "iPadPro129",
  "iPhone15Pro",
  "MacBookPro14",
  "MacBookPro16",
]);

export type DeviceType = z.infer<typeof deviceTypeSchema>;

export const configSchema = z
  .object({
    $schema: z.string().default("https://webget.com/schema.json"),
    url: z.string().default("https://estii.com"),
    deviceScaleFactor: z.number().min(1).default(2),
    baseUrl: z.string().optional(),
    width: z.number().min(1).default(1280),
    height: z.number().min(1).default(720),
    actions: z.array(Action).default([]),
    quality: z.number().min(0).max(100).default(80),
    reducedMotion: z.enum(["no-preference", "reduce"]).default("reduce"),
    colorScheme: z
      .enum(["no-preference", "light", "dark"])
      .default("no-preference"),
    forcedColors: z.enum(["none", "active"]).default("none"),
    device: z.optional(deviceTypeSchema),
    template: z.string().optional(),
  })
  .describe("Screenshot configuration")
  .strict();

export type Config = z.infer<typeof configSchema> & { path: string };

async function getBaseConfig(path: string) {
  const dir = dirname(path);
  if (dir === "/") {
    return null;
  }

  path = join(dir, "webget.json");
  if (await Bun.file(path).exists()) {
    return readConfig(path);
  }

  return getBaseConfig(dir);
}

async function readConfig(path: string) {
  return configSchema.parse(await Bun.file(path).json());
}

export async function getConfig(path: string) {
  const base = await getBaseConfig(path);
  const config = await readConfig(`${path}.json`);
  return { ...base, ...config, path };
}
