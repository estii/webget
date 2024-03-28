import type { Asset } from "./schema";
export type { Cookie } from "./schema";

export type WebgetConfig = {
  setup(asset: Asset): Promise<Asset>;
};
