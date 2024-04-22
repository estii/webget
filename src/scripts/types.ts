import prettier from "prettier";
import { createTypeAlias, printNode, zodToTs } from "zod-to-ts";
import { assetConfigSchema } from "../schema";

const { node } = zodToTs(assetConfigSchema, "Asset");

const asset = createTypeAlias(node, "Asset");

const config = `export type WebgetConfig = {
  setup(asset: Asset): Asset | Promise<Asset>;
};`;

const types = `declare module "webget" {
  export ${printNode(asset)}
  
  ${config}
}`;

const formatted = await prettier.format(types, { parser: "typescript" });
Bun.write("src/index.d.ts", formatted);
