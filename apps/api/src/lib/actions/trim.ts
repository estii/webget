import { ActionContext } from "../action";
import { set } from "./set";

export type TrimParams = {
  type: "in" | "out";
};

export async function trim(ctx: ActionContext, { type }: TrimParams) {
  if (ctx.output.type !== "webm") {
    throw new Error("Output is not a video");
  }
  if (type === "in") {
    await set(ctx, { type: "webm", trimLeft: Date.now() });
  } else {
    if (ctx.output.trimRight === 0) {
      await set(ctx, { type: "webm", trimRight: Date.now() });
    }
  }
}
