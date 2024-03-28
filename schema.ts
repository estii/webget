import { dirname, join } from "node:path";
import { z } from "zod";
import { clickActionSchema } from "./actions/click";
import { cropActionSchema } from "./actions/crop";
import { fillActionSchema } from "./actions/fill";
import { hoverActionSchema } from "./actions/hover";
import { WaitAction as waitActionSchema } from "./actions/wait";

export const actionSchema = z.discriminatedUnion("type", [
  clickActionSchema,
  hoverActionSchema,
  fillActionSchema,
  waitActionSchema,
  cropActionSchema,
]);

export type Action = z.infer<typeof actionSchema>;

export const cookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string(),
  path: z.string().default("/"),
  expires: z.number().default(() => -1),
  httpOnly: z.boolean().default(false),
  secure: z.boolean().default(false),
  sameSite: z.enum(["Strict", "Lax", "None"]).default("None"),
});

export type Cookie = z.infer<typeof cookieSchema>;

const originSchema = z.object({
  origin: z.string(),
  localStorage: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .default([]),
});

export const storageStateSchema = z.object({
  cookies: z.array(cookieSchema).default([]),
  origins: z.array(originSchema).default([]),
});

export const assetSchema = z
  .object({
    $schema: z.string().default("https://webget.com/schema/asset.json"),
    url: z.string(),
    deviceScaleFactor: z.number().min(1).max(3).optional(),
    baseUrl: z.string().optional(),
    width: z.number().min(1).optional(),
    height: z.number().min(1).optional(),
    actions: z.array(actionSchema).default([]),
    quality: z.number().min(0).max(100).optional(),
    reducedMotion: z.enum(["no-preference", "reduce"]).optional(),
    colorScheme: z.enum(["no-preference", "light", "dark"]).optional(),
    forcedColors: z.enum(["none", "active"]).optional(),
    template: z.string().optional(),
    storageState: storageStateSchema.optional(),
  })
  .describe("Asset configuration")
  .strict();

export type Asset = z.infer<typeof assetSchema> & {
  output: string;
  input: string;
  type: "png" | "jpeg";
};

async function findFile(path: string, name: string) {
  const dir = dirname(path);
  if (dir === "/") {
    return null;
  }

  path = join(dir, name);
  if (await Bun.file(path).exists()) {
    return path;
  }

  return findFile(dir, name);
}

function formatIssue(issue?: z.ZodIssue) {
  // console.log(issue);
  switch (issue?.code) {
    case "invalid_type":
      if (issue.received === "undefined") {
        return `asset.${issue.path.join(".")} is required`;
      }
      return `asset.${issue.path.join(".")} expected ${
        issue.expected
      } but got ${issue.received}`;
    default:
      return "asset not valid";
  }
}

async function getConfig(path: string): Promise<WebgetConfig> {
  const file = await findFile(path, "webget.config.ts");
  if (file === null) return { setup: async (config: Asset) => config };
  return import(file).then((module) => module.default as WebgetConfig);
}

async function readAsset(path: string) {
  const result = assetSchema.safeParse(await Bun.file(path).json());
  if (result.success) {
    return result.data;
  }
  throw new Error(formatIssue(result.error.issues[0]));
}

function getType(output: string) {
  if (output.endsWith(".png")) {
    return "png";
  }
  if (output.endsWith(".jpg")) {
    return "jpeg";
  }
  throw new Error(`Invalid file type ${output}`);
}

export async function getAsset(output: string): Promise<Asset> {
  const type = getType(output);
  const input = `${output}.json`;
  const settings = await readAsset(input);
  const asset: Asset = { ...settings, output, input, type };
  const config = await getConfig(output);
  return config.setup(asset);
}

export type WebgetConfig = {
  setup(asset: Asset): Promise<Asset>;
};
