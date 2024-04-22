import { dirname, join } from "node:path";
import { z } from "zod";

export const gotoActionSchema = z
  .object({
    type: z.literal("goto"),
    url: z.string(),
  })
  .strict();

export type GotoAction = z.infer<typeof gotoActionSchema>;
export type GotoParams = Omit<GotoAction, "type">;

export const clickActionSchema = z
  .object({
    type: z.literal("click"),
    selector: z.string(),
    frameSelector: z.string().optional(),
    clickCount: z.number().min(1).max(3).optional(),
    button: z.enum(["left", "right", "middle"]).optional(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
  })
  .strict();

export type ClickAction = z.infer<typeof clickActionSchema>;
export type ClickParams = Omit<ClickAction, "type">;

export const cropActionSchema = z
  .object({
    type: z.literal("crop"),
    selector: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    padding: z.number().optional(),
    fullPage: z.boolean().optional(),
  })
  .strict();

export type CropAction = z.infer<typeof cropActionSchema>;
export type CropParams = Omit<CropAction, "type">;

export const fillActionSchema = z
  .object({
    type: z.literal("fill"),
    selector: z.string(),
    frame: z.string().optional(),
    text: z.string(),
  })
  .strict();

export type FillAction = z.infer<typeof fillActionSchema>;
export type FillParams = Omit<FillAction, "type">;

export const hoverActionSchema = z
  .object({
    type: z.literal("hover"),
    selector: z.string(),
    frame: z.string().optional(),
  })
  .strict();

export type HoverAction = z.infer<typeof hoverActionSchema>;
export type HoverParams = Omit<HoverAction, "type">;

export const scrollActionSchema = z
  .object({
    type: z.literal("scroll"),
    selector: z.string(),
    offset: z.number().optional(),
  })
  .strict();

export type ScrollAction = z.infer<typeof scrollActionSchema>;
export type ScrollParams = Omit<ScrollAction, "type">;

export const waitActionSchema = z
  .object({
    type: z.literal("wait"),
    milliseconds: z.number(),
  })
  .strict();

export type WaitAction = z.infer<typeof waitActionSchema>;

export const actionSchema = z.discriminatedUnion("type", [
  gotoActionSchema,
  clickActionSchema,
  hoverActionSchema,
  fillActionSchema,
  waitActionSchema,
  cropActionSchema,
  scrollActionSchema,
]);

export type Action = z.infer<typeof actionSchema>;

export const cookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string(),
  path: z.string(),
  expires: z.number(),
  httpOnly: z.boolean(),
  secure: z.boolean(),
  sameSite: z.enum(["Strict", "Lax", "None"]),
});

export type Cookie = z.infer<typeof cookieSchema>;

const originSchema = z.object({
  origin: z.string(),
  localStorage: z.array(z.object({ name: z.string(), value: z.string() })),
});

export const storageStateSchema = z.object({
  cookies: z.array(cookieSchema).optional(),
  origins: z.array(originSchema).optional(),
});

export const assetConfigBaseSchema = z
  .object({
    $schema: z.literal("https://usewebget.com/schema/v1.json").optional(),
    url: z.string(),
    deviceScaleFactor: z.number().min(1).max(3).optional(),
    baseUrl: z.string().optional(),
    border: z.string().optional(),
    width: z.number().min(1).optional(),
    height: z.number().min(1).optional(),
    actions: z.array(actionSchema).optional(),
    quality: z.number().min(0).max(100).optional(),
    reducedMotion: z.enum(["no-preference", "reduce"]).optional(),
    colorScheme: z.enum(["no-preference", "light", "dark"]).optional(),
    forcedColors: z.enum(["none", "active"]).optional(),
    storageState: storageStateSchema.optional(),
    omitBackground: z.boolean().optional(),
    type: z.enum(["png", "jpeg"]).optional(),
    headed: z.boolean().optional(),
    diff: z.boolean().optional(),
  })
  .strict();

export type AssetConfig = z.infer<typeof assetConfigBaseSchema> & {
  inputs?: Record<string, AssetConfig>;
};

export const assetConfigSchema: z.ZodType<AssetConfig> =
  assetConfigBaseSchema.extend({
    inputs: z.record(z.lazy(() => assetConfigSchema)).optional(),
  });

export const assetBaseSchema = assetConfigBaseSchema.extend({
  output: z.string(),
  input: z.string(),
});

export type Asset = z.infer<typeof assetBaseSchema> & {
  inputs?: Record<string, AssetConfig>;
};

export const assetSchema: z.ZodType<Asset> = assetBaseSchema.extend({
  inputs: z.record(z.lazy(() => assetConfigSchema)).optional(),
});

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
  console.log(issue);
  switch (issue?.code) {
    case "invalid_type":
      if (issue.received === "undefined") {
        return `asset.${issue.path.join(".")} is required`;
      }
      return `asset.${issue.path.join(".")} expected ${
        issue.expected
      } but got ${issue.received}`;
    case "unrecognized_keys":
      return `unexpected key ${issue.keys.join(".")}`;
    default:
      return "asset not valid";
  }
}

let version = 0;

async function getConfig(path: string): Promise<WebgetConfig> {
  const file = await findFile(path, "webget.config.ts");
  if (file === null) return { setup: async (asset: Asset) => asset };
  const uncached = `${file}?cache=${version++}`;
  return import(uncached).then((module) => module.default as WebgetConfig);
}

async function readAsset(path: string) {
  const result = assetConfigSchema.safeParse(await Bun.file(path).json());
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

export async function getAsset(
  output: string,
  headed = false,
  diff = false
): Promise<Asset> {
  const type = getType(output);
  const input = `${output}.json`;
  const settings = await readAsset(input);
  const asset: Asset = { ...settings, output, input, type, headed, diff };
  const config = await getConfig(output);
  return config.setup(asset);
}

export type WebgetConfig = {
  setup(asset: Asset): Promise<Asset>;
};
