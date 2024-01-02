import { easeInOutQuad, easeOutSine } from "../../easing";
import {
  FRAME_DURATION,
  SCROLL_PADDING,
  getTargetPosition,
  wait,
} from "../../utils";
import { ActionContext, ActionOptions } from "../action";
import {
  getMaxScrollPosition,
  getTargetScroll,
  scrollToLocator,
} from "./scroll";

export type HoverParams = Partial<ActionOptions>;

// moves and scrolls until the locator is on screen
export async function hover(
  ctx: ActionContext,
  selector: string,
  options: HoverParams = {}
) {
  if (ctx.output.type === "webm") {
    const loc = ctx.page.locator(selector);
    await loc.waitFor({ state: "attached" });

    let {
      scrollOffset = 0,
      noScroll = false,
      noMove = false,
      speed = 1,
    } = options;
    const { x: startX, y: startY } = ctx.output.mouse;
    const { y: scrollY } = ctx.output.scroll;

    const page = loc.page();

    let target = await getTargetPosition(ctx, loc, options);
    let scroll = await getTargetScroll(ctx, loc, options);

    let difScroll = 0;
    let difMouse = 0;
    let dif = 0;
    let steps = 0;

    if (!noScroll) {
      if (scroll < 400) {
        scroll = 0;
      }

      scroll += scrollOffset;
      scroll = Math.max(0, Math.floor((scroll - SCROLL_PADDING) / 100)) * 100;

      const maxScroll = await getMaxScrollPosition(loc);

      scroll = Math.min(scroll, maxScroll);

      await scrollToLocator(loc, scroll);
      ctx.output.scroll = { x: 0, y: scroll };

      target.y = Math.abs(scroll - scrollY - target.y);

      difScroll = Math.abs(scroll - scrollY);

      if (noMove) {
        steps = 2 + Math.round(dif / 100) * 3;

        await wait(ctx, steps * FRAME_DURATION * speed); //fake delay during animation
      }
    }

    if (!noMove) {
      const difX = target.x - startX;
      const difY = target.y - startY;

      difMouse = Math.sqrt(Math.pow(difX, 2) + Math.pow(difY, 2));
      dif = Math.max(difMouse, difScroll);

      steps = Math.min(20, Math.max(10, 2 + Math.round(dif / 100) * 3)) * speed;

      for (let i = 0; i < steps; i++) {
        const step = easeInOutQuad((i + 1) / steps);
        let stepX = easeOutSine((i + 1) / steps);

        if (difY === 0) {
          stepX = step;
        }
        const x = startX + difX * stepX;
        const y = startY + difY * step;

        await page.mouse.move(x, y);
        ctx.output.mouse = { x, y };

        await wait(ctx, FRAME_DURATION);
      }
    }
  } else {
    await ctx.page.hover(selector);
    await wait(ctx, 50);
  }
}
