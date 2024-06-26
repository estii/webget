import type { WebgetConfig } from "./src/types";

const config: WebgetConfig = {
  async setup(asset) {
    return {
      baseUrl: "https://app.estii.com",
      ...asset,
    };
  },
};

export default config;
