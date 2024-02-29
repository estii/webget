import { dirname, join } from "node:path";
import { z } from "zod";

export const ClickAction = z.object({
  type: z.literal("click"),
  selector: z.string(),
  frame: z.string().optional(),
});

export type ClickAction = z.infer<typeof ClickAction>;

export const Action = z.discriminatedUnion("type", [ClickAction]);

export type Action = z.infer<typeof Action>;

export const Config = z
  .object({
    $schema: z.string().default("https://webget.com/schema.json"),
    url: z.string().default("https://estii.com"),
    deviceScaleFactor: z.number().min(1).default(2),
    baseUrl: z.string().optional(),
    width: z.number().min(1).default(1280),
    height: z.number().min(1).default(720),
    actions: z.array(Action).default([]),
  })
  .describe("Screenshot configuration")
  .strict();

export type Config = z.infer<typeof Config> & { path: string };

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
  return Config.parse(await Bun.file(path).json());
}

export async function getConfig(path: string) {
  const base = await getBaseConfig(path);
  const config = await readConfig(`${path}.json`);
  return { ...base, ...config, path };
}
