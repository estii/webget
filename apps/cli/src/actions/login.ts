import { ActionContext } from "../../../api/src/lib/action";
import { logComplete, logStart } from "../api";
import { client } from "../client";

export type RestoreParams = {
  id: string;
};

export async function login(ctx: ActionContext, user: string) {
  let session = user;
  if (session === "kiera.demo@estii.com") {
    session = "jvvluumy8n";
  }

  if (ctx.state.session === session) {
    return;
  }

  const start = logStart("login", user);
  const cookies = await client.states.get.query(session);
  if (!cookies) {
    throw new Error("Session not found");
  }
  await ctx.context.addCookies(cookies.cookies);
  ctx.state.session = session;

  logComplete(start);
}
