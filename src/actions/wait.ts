import type { Page } from "playwright";
import { z } from "zod";

export const waitActionSchema = z
  .object({
    type: z.literal("wait"),
    milliseconds: z.number(),
  })
  .strict();

export type WaitAction = z.infer<typeof waitActionSchema>;

export async function waitAction(page: Page, action: WaitAction) {
  await page.waitForTimeout(action.milliseconds);
}
