import type { Page } from "playwright";
import { z } from "zod";

export const FillAction = z.object({
  type: z.literal("fill"),
  selector: z.string(),
  frame: z.string().optional(),
  text: z.string(),
});

export type FillAction = z.infer<typeof FillAction>;

export async function fillAction(page: Page, action: FillAction) {
  await page.locator(action.selector).fill(action.text);
}
