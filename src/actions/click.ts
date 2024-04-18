import type { Frame, Page } from "playwright";
import { z } from "zod";

export const clickActionSchema = z
  .object({
    type: z.literal("click"),
    selector: z.string(),
    frame: z.string().optional(),
    count: z.number().min(1).max(3).default(1),
    button: z.enum(["left", "right", "middle"]).default("left"),
    position: z.optional(z.object({ x: z.number(), y: z.number() })),
  })
  .strict();

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
    await target.locator(action.selector).click({
      clickCount: action.count,
      button: action.button,
      position: action.position,
    });
  } catch (error) {
    throw new Error(`selector "${action.selector}" not found`);
  }

  // move mouse out of the way
  await page.mouse.move(0, 0);
}
