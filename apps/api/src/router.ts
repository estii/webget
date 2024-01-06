import { stateRouter } from "./states";
import { procedure, router } from "./trpc";

export const testRouter = router({
  get: procedure.query(async ({ ctx }) => {
    const id = "h3DW4r";
    const screenshots = await ctx.env.SCREENSHOTS.list({ prefix: `${id}/` });
    return screenshots.objects;
  }),
});

export const appRouter = router({
  states: stateRouter,
  test: testRouter,
});

export type AppRouter = typeof appRouter;
