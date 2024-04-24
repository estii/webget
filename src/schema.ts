import { z } from "zod";

export const gotoActionSchema = z
  .object({
    type: z.literal("goto"),
    url: z.string(),
    waitUntil: z
      .enum(["load", "domcontentloaded", "networkidle0", "networkidle2"])
      .optional(),
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

export const assetBaseSchema = z
  .object({
    $schema: z
      .literal("https://webget.estii.workers.dev/schema/v1.json")
      .optional(),
    url: z.string(),
    deviceScaleFactor: z.number().min(1).max(3).default(1),
    baseUrl: z.string().optional(),
    border: z.string().optional(),
    width: z.number().min(1).default(1280),
    height: z.number().min(1).default(720),
    actions: z.array(actionSchema).default([]),
    quality: z.number().min(0).max(100).default(100),
    reducedMotion: z.enum(["no-preference", "reduce"]).optional(),
    colorScheme: z.enum(["no-preference", "light", "dark"]).optional(),
    forcedColors: z.enum(["none", "active"]).optional(),
    storageState: storageStateSchema.optional(),
    omitBackground: z.boolean().optional(),
    type: z.enum(["png", "jpeg"]).default("png"),
    headed: z.boolean().default(false),
    diff: z.boolean().default(false),
  })
  .strict();

export type Asset = z.output<typeof assetBaseSchema> & {
  inputs: Record<string, Asset>;
};

type AssetInput = z.input<typeof assetBaseSchema> & {
  inputs: Record<string, AssetInput>;
};

export const assetSchema: z.ZodType<Asset, any, AssetInput> =
  assetBaseSchema.extend({
    inputs: z.lazy(() => z.record(assetSchema)),
  });

export function formatIssue(issue?: z.ZodIssue) {
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

export type WebgetConfig = {
  setup(asset: Asset): Promise<Asset>;
};
