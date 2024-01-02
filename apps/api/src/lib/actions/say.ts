import { ActionContext } from "../action";
import { getCaptionDuration } from "../caption";
import { set } from "./set";
import { wait } from "./wait";

export type SayParams = {
  text: string;
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
};

export async function say(ctx: ActionContext, { text }: SayParams) {
  set(ctx, { caption: text });
  await wait(ctx, getCaptionDuration(text));
  set(ctx, { caption: null });
}
