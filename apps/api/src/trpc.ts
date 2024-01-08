import { initTRPC } from "@trpc/server";
import { Env } from ".";

export type FetchContext = {
  env: Env;
  req: Request;
  url: URL;
};

export const { procedure, router } = initTRPC
  .context<FetchContext>()
  .create({});
