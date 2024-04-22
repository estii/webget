import zodToJsonSchema from "zod-to-json-schema";
import { assetConfigSchema } from "../schema";

const path = "web/public/schema/v1.json";
const schema = zodToJsonSchema(assetConfigSchema);
Bun.write(path, JSON.stringify(schema, null, 2));
