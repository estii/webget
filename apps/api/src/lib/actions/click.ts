import { CLICK_DURATION, getTargetPosition, wait } from "../../utils";
import { ActionContext, ActionOptions } from "../action";
import { logComplete, logStart } from "../api";

export type ClickOptions = Partial<ActionOptions>;

export async function click(
  ctx: ActionContext,
  selector: string,
  options: ClickOptions = {}
) {
  const start = logStart("click", selector);

  if (ctx.output.type === "webm") {
    const { offsetClick, speed = 1 } = options;
    const delay = CLICK_DURATION * speed;

    if (!offsetClick) {
      options = { placement: "center", ...options };
    }

    const loc = ctx.page.locator(selector);
    let relative = await getTargetPosition(ctx, loc, options, true);
    let absolute = await getTargetPosition(ctx, loc, options);

    await ctx.page.mouse.move(absolute.x, absolute.y);
    await loc.click({ position: relative });
    await ctx.page.mouse.move(absolute.x, absolute.y);

    await wait(ctx, delay);
  } else {
    await ctx.page.click(selector);
    await wait(ctx, 50);
  }

  logComplete(start);
}
