import { unlinkSync } from "node:fs";
const glob = new Bun.Glob("tests/**/*.{png,jpg}");
for (const path of glob.scanSync()) {
  console.log(`rm ${path}`);
  unlinkSync(path);
}
