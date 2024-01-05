import { DeepPartial } from "@trpc/server";
import { ActionContext, Output } from "../../../api/src/lib/action";

export type SetParams = DeepPartial<Output>;

function deepMerge(target: any, source: any) {
  for (const key in source) {
    const value = source[key];
    if (value && typeof value === "object") {
      target[key] = deepMerge(target[key] ?? {}, source[key]);
    } else {
      target[key] = value;
    }
  }
  return target;
}

export async function set(ctx: ActionContext, update: SetParams) {
  deepMerge(ctx.output, update);

  if (update.width || update.height) {
    await ctx.page.setViewportSize({
      width: ctx.output.width,
      height: ctx.output.height,
    });
  }

  // await ctx.page.evaluateHandle((output) => {
  //   console.log("evaluateHandle", window.onOutput);
  //   window.onOutput && window.onOutput(output);
  // }, ctx.output);
}
