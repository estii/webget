import type { WebgetConfig } from "./types";

const config: WebgetConfig = {
  async setup(context, config) {
    await context.addCookies([
      { name: "estii.session", value: "value", url: "https://app.estii.com" },
    ]);
  },
};

export default config;
