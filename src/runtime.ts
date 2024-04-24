import type { Browser, Page } from "puppeteer";
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

let runtime: Page | null = null;

async function getRuntime(browser: Browser) {
  if (runtime === null) {
    runtime = await browser.newPage();
    const script = await getScript();
    await runtime.addScriptTag({ content: script });
    await runtime.goto(SERVER_URL);
    runtime.on("console", (msg) => console.log(msg.type(), msg.text()));
    runtime.on("pageerror", (msg) => console.log("runtime", msg));
  }
  return runtime;
}

export async function compare(browser: Browser, params: CompareParams) {
  const page = await getRuntime(browser);
  return page.evaluate((params) => window.compare(params), params);
}

declare global {
  interface Window {
    compare: (params: CompareParams) => Promise<CompareResult>;
  }
}
