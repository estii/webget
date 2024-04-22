// import { type Page } from "playwright";
// import { getBrowser } from "./browser/playwright";
import type { Page } from "puppeteer";
import { getBrowser } from "./browser/puppeteer";
import { SERVER_URL } from "./constants";
import type { CompareParams, CompareResult } from "./runtime-script";

async function getScript() {
  const output = await Bun.build({
    entrypoints: ["./src/runtime-script.ts"],
    target: "browser",
  });

  const [script] = output.outputs;
  if (script) return script.text();
  console.log(output.logs);
  throw new Error("No script found");
}

let runtime: Promise<Page> | null = null;
function getRuntime() {
  if (runtime === null) {
    runtime = getBrowser().then(async (browser) => {
      const page = await browser.newPage();
      const script = await getScript();
      // await page.addInitScript({ content: script });
      await page.addScriptTag({ content: script });
      await page.goto(SERVER_URL);
      page.on("console", (msg) => console.log(msg.type(), msg.text()));
      page.on("pageerror", (msg) => console.log("runtime", msg));
      return page;
    });
  }
  return runtime;
}

export async function compare(params: CompareParams) {
  const page = await getRuntime();
  return page.evaluate((params) => window.compare(params), params);
}

declare global {
  interface Window {
    compare: (params: CompareParams) => Promise<CompareResult>;
  }
}
