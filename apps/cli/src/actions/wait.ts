import { ActionContext } from "../../../api/src/lib/action";
import { logComplete, logStart } from "../api";

export async function wait(ctx: ActionContext, ms: number) {
  const start = logStart("wait", ms);
  await ctx.page.waitForTimeout(ms);
  logComplete(start);
}
