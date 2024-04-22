import { PORT } from "./constants";
import { api } from "./server";

export default { fetch: api.fetch, port: PORT };
