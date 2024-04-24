import prettier from "prettier";
import { createTypeAlias, printNode, zodToTs } from "zod-to-ts";
import { assetSchema } from "../schema";

const { node } = zodToTs(assetSchema, "Asset");

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
