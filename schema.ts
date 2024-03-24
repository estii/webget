import zodToJsonSchema from "zod-to-json-schema";
import { configSchema } from "./config";

const schema = zodToJsonSchema(configSchema);
Bun.write("schema.json", JSON.stringify(schema, null, 2));
