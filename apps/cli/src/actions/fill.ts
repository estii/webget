import { ActionContext } from "../action";
import { wait } from "../utils";

export type FillParams = {
  selector: string;
  text: string;
};

export async function fill(ctx: ActionContext, action: FillParams) {
  await ctx.page.fill(action.selector, action.text);
  await wait(ctx, 50);
}
