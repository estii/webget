#!/usr/bin/env bun
import { Command, CommanderError } from "@commander-js/extra-typings";
import child_process from "child_process";
import { existsSync, lstatSync, writeFileSync } from "fs";
import { globSync } from "glob";
import { chromium } from "playwright";
import { generateFiles, getAsset } from "./api";
import { client } from "./client";

type ScriptProps = { id: string; url: string; width: number; height: number };

function getScript({ id, url, width, height }: ScriptProps) {
  return `import page from "webget"

page.set({ width: ${width}, height: ${height} });

page.restore({ id: "${id}" });

page.goto({ url: "${url}" });
`;
}

const loginCommand = new Command("login")
  .description("Login to webget")
  .action(async () => {
    console.log("login");
  });

async function newAsset(path: string) {
  const asset = getAsset(path);
  if (existsSync(asset.input)) {
    throw new Error("Script already exists");
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://usewebget.com/new");

  let complete: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    complete = resolve;
  });

  page.on("close", async () => {
    const url = page.url();
    const cookies = await context.cookies();
    const { id } = await client.states.put.mutate({ url, cookies });
    browser.close();

    const size = page.viewportSize();
    writeFileSync(
      asset.input,
      getScript({ id, url, width: 800, height: 600, ...size })
    );
    complete && complete();
  });

  return promise;
}

const devCommand = new Command("dev")
  .description("Create new state")
  .argument("<path>", "The path of the asset")
  .action(async (path) => {
    child_process.spawn("yarn", ["build:watch"], {});

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("http://localhost:3050");
  });

const program = new Command()
  .name("webget")
  .description("Get images and videos from the web")
  .argument("<path>", "The path to the assets")
  .option("--debug", "Enable debug mode")
  .action(async (path, { debug }) => {
    if (existsSync(path)) {
      // check if path is a directory
      if (lstatSync(path).isDirectory()) {
        const files = globSync(`${path}/**/*.ts`);
        await generateFiles(files, { debug });
      } else {
        await generateFiles([path], { debug });
      }
    } else {
      await newAsset(path);
      await generateFiles([path], { debug });
    }
  });

program.addCommand(loginCommand);
program.addCommand(devCommand);
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (e) {
  const error = e as CommanderError;
  const { exitCode, code, message } = error;
  if (code === "commander.help" && exitCode === 1) {
    process.exit();
  } else {
    console.log(message);
    process.exit(error.exitCode);
  }
}
