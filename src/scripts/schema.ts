import zodToJsonSchema from "zod-to-json-schema";
import { assetSchema } from "../schema";

const path = "./static/schema/v1.json";
const schema = zodToJsonSchema(assetSchema);
Bun.write(path, JSON.stringify(schema, null, 2));
