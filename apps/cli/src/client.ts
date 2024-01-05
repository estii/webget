import { createTRPCProxyClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@webget/api";

// const API_URL = "http://0.0.0.0:8787";
const API_URL = "https://webget.estii.workers.dev";

export const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpLink({
      url: `${API_URL}/trpc`,
    }),
  ],
});
