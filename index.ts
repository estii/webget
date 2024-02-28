#! /usr/bin/env bun

import { Glob } from "bun";
import { unlink } from "node:fs/promises";
import { chromium } from "playwright";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";
import type { SsimResult } from "./browser";

const Config = z
  .object({
    url: z.string().url().default("https://estii.com"),
    width: z.number().min(1).default(1280),
    height: z.number().min(1).default(720),
  })
  .strict();

type Config = z.infer<typeof Config>;

function getInputs() {
  return new Glob("**/*.{png,jpg}.json").scan();
}

function getOutput(path: string) {
  return path.replace(".json", "");
}

function getTemp(path: string) {
  return path
    .replace(".json", "")
    .replace(".jpg", ".temp.jpg")
    .replace(".png", ".temp.png");
}

function getType(path: string) {
  if (path.endsWith(".png")) {
    return "png";
  }
  if (path.endsWith(".jpg")) {
    return "jpeg";
  }
  throw new Error(`Invalid file type ${path}`);
}

function getContentType(path: string) {
  const type = getType(path);
  return `image/${type}` as const;
}

async function getConfig(path: string) {
  const json = await Bun.file(path).json();
  return Config.parse(json);
}

function getServer() {
  return Bun.serve({
    port: 3000,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/") {
        return new Response("Hello, World!");
      }
      const contentType = getContentType(path);
      // console.log(`.${path}`, contentType);
      const file = Bun.file(`.${path}`);
      return new Response(file, { headers: { "Content-Type": contentType } });
    },
    error() {
      return new Response(null, { status: 404 });
    },
  });
}

async function getScript() {
  const output = await Bun.build({
    entrypoints: ["browser.ts"],
    target: "browser",
  });

  const [script] = output.outputs;
  if (script) return script.text();

  throw new Error("No script found");
}

yargs(hideBin(process.argv))
  .command("serve", "Starts a server", () => {
    const server = getServer();
  })
  .command("ls", "Lists images in current directory", async () => {
    const server = getServer();
    const script = await getScript();
    const browser = await chromium.launch();

    const runtime = await browser.newPage();
    await runtime.addInitScript({ content: script });
    await runtime.goto("http://localhost:3000");

    for await (const input of getInputs()) {
      const output = getOutput(input);
      const type = getType(output);
      const temp = getTemp(input);

      const config = await getConfig(input);
      const page = await browser.newPage({
        screen: { width: config.width, height: config.height },
      });
      // page.on("console", (msg) => console.log("log", msg.text()));
      // page.on("pageerror", (msg) => console.log("error", msg));

      await page.goto(config.url, { waitUntil: "networkidle" });

      const exists = await Bun.file(output).exists();
      const path = exists ? temp : output;
      await page.screenshot({ path, type });

      if (exists) {
        const result = await runtime.evaluate(
          ({ path1, path2 }) => {
            return window.compare(path1, path2);
          },
          {
            path1: output,
            path2: temp,
          }
        );
        if (result.ssim < 0.95) {
          await Bun.write(output, Bun.file(temp));
          console.log(`updated: ${output} (ssim: ${result.ssim})`);
        } else {
          console.log(`matched: ${output}`);
        }
        await unlink(temp);
      } else {
        console.log(`created: ${output}`);
      }

      await page.close();
    }

    await browser.close();
    server.stop();
  })
  .parse();

// declare global function compare to window
declare global {
  interface Window {
    compare: (path1: string, path2: string) => Promise<SsimResult>;
  }
}
