import type { WebgetConfig } from "./types";

const config: WebgetConfig = {
  async setup(asset) {
    return {
      baseUrl: "https://app.estii.com",
      deviceScaleFactor: 2,
      ...asset,
    };
  },
};

export default config;