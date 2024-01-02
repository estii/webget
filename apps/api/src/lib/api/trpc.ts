import { initTRPC } from "@trpc/server";

export type FetchContext = {
  env: Env;
  req: Request;
  url: URL;
};

export const { procedure, router } = initTRPC
  .context<FetchContext>()
  .create({});
