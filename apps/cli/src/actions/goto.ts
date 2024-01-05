import { ActionContext } from "../../../api/src/lib/action";
import { logComplete, logStart } from "../api";
import { set } from "./set";

export async function goto(ctx: ActionContext, url: string) {
  const baseURL = ctx.output.baseURL;
  if (baseURL) url = `${baseURL}${url}`;

  // if (ctx.page.url() === url) {
  //   return;
  // }

  const start = logStart("goto", url);
  await ctx.page.goto(url);
  await ctx.page.waitForLoadState("networkidle");
  await set(ctx, {});
  logComplete(start);
}
