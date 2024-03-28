import type { Page } from "playwright";
import { z } from "zod";

export const WaitAction = z.object({
  type: z.literal("wait"),
  milliseconds: z.number(),
});

export type WaitAction = z.infer<typeof WaitAction>;

export async function waitAction(page: Page, action: WaitAction) {
  await page.waitForTimeout(action.milliseconds);
}
