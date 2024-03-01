import type { Page } from "playwright";
import { z } from "zod";

export const HoverAction = z.object({
  type: z.literal("hover"),
  selector: z.string(),
  frame: z.string().optional(),
});

export type HoverAction = z.infer<typeof HoverAction>;

export async function hoverAction(page: Page, action: HoverAction) {
  await page.locator(action.selector).hover();
}
