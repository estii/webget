import zodToJsonSchema from "zod-to-json-schema";
import { Config } from "../config";

const schema = zodToJsonSchema(Config);
Bun.write("schema.json", JSON.stringify(schema, null, 2));
