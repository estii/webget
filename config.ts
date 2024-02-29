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
    url: z.string().url().default("https://estii.com"),
    deviceScaleFactor: z.number().min(1).default(2),
    baseUrl: z.string().optional(),
    width: z.number().min(1).default(1280),
    height: z.number().min(1).default(720),
    actions: z.array(Action).default([]),
  })
  .describe("Screenshot configuration")
  .strict();

export type Config = z.infer<typeof Config> & { path: string };
