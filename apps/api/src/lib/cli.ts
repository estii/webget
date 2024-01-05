#!/usr/bin/env node
import { Command, CommanderError } from "@commander-js/extra-typings";
import { spawnSync } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { globSync } from "glob";
import { chromium } from "playwright";
import { client } from "../../../cli/src/client";

function getScript(id: string) {
  return `import * as webget from "webget"

await webget.resize(800, 600);

await webget.start("${id}");

await webget.save();
`;
}

const loginCommand = new Command("login")
  .description("Login to webget")
  .action(async () => {
    console.log("login");
  });

function getAsset(path: string) {
  let output = path;
  let script = path;
  if (path.endsWith(".ts")) {
    output = path.slice(0, -3);
  } else {
    script = `${path}.ts`;
  }

  const extension = output.split(".").pop();
  switch (extension) {
    case "jpg":
    case "jpeg":
    case "png":
      return {
        type: "image",
        format: extension === "png" ? "png" : "jpeg",
        output,
        script,
      };
    case "gif":
    case "webp":
    case "mp4":
      return {
        type: "video",
        format: extension,
        output,
        script,
      };
    default:
      throw new Error("Unsupported format");
  }
}

const newCommand = new Command("new")
  .description("Create new state")
  .argument("<file>", "The path of the asset")
  .action(async (path) => {
    const format = getAsset(path);
    if (existsSync(format.script)) {
      throw new Error("Script already exists");
    }

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("https://usewebget.com/new");

    page.on("close", async () => {
      const url = page.url();
      const cookies = await context.cookies();
      const { id } = await client.put.mutate({ url, cookies });
      browser.close();

      writeFileSync(format.script, getScript(id));
    });
  });

const runCommand = new Command("run")
  .description("Generates assets in a folder")
  .argument("<file>", "The path to the assets")
  .action(async (path) => {
    const files = globSync(`${path}/**/*.ts`);
    for (const file of files) {
      const asset = getAsset(file);
      console.log(`generating ${asset.output}`);
      const result = spawnSync("tsx", [file]);
      // console.log(result.stdout.toString());
      // console.log(result.stderr.toString());
    }
  });

const program = new Command();
program.name("webget").description("Get images and videos from the web");
program.addCommand(loginCommand);
program.addCommand(newCommand);
program.addCommand(runCommand);
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
