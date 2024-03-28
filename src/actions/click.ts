import type { Frame, Page } from "playwright";
import { z } from "zod";

export const clickActionSchema = z.object({
  type: z.literal("click"),
  selector: z.string(),
  frame: z.string().optional(),
});

export type ClickAction = z.infer<typeof clickActionSchema>;

export async function clickAction(page: Page, action: ClickAction) {
  let target: Page | Frame = page;

  if (action.frame) {
    const frame = page.frame(action.frame);
    if (!frame) {
      throw new Error(`frame "${action.frame}" not found`);
    }
    target = frame;
  }

  try {
    await target.locator(action.selector).click();
  } catch (error) {
    throw new Error(`selector "${action.selector}" not found`);
  }
}
