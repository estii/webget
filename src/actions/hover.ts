import type { Page } from "playwright";
import { z } from "zod";

export const hoverActionSchema = z.object({
  type: z.literal("hover"),
  selector: z.string(),
  frame: z.string().optional(),
});

export type HoverAction = z.infer<typeof hoverActionSchema>;

export async function hoverAction(page: Page, action: HoverAction) {
  await page.locator(action.selector).hover();
}
