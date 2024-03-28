import zodToJsonSchema from "zod-to-json-schema";
import { assetSchema } from "../schema";

const schema = zodToJsonSchema(assetSchema);
Bun.write("schema.json", JSON.stringify(schema, null, 2));
