import { spawnSync } from "child_process";
import colors from "colors";
import fs from "fs";
import ora from "ora";
import path from "path";
import { chromium } from "playwright";
import {
  ActionContext,
  ActionState,
  ArgsUnion,
  Asset,
  Output,
  defaultOutput,
} from "./action";
import { click } from "./actions/click";
import { fill } from "./actions/fill";
import { goto } from "./actions/goto";
import { hover } from "./actions/hover";
import { login } from "./actions/login";
import { say } from "./actions/say";
import { screenshot } from "./actions/screenshot";
import { scroll } from "./actions/scroll";
import { set } from "./actions/set";
import { trim } from "./actions/trim";
import { wait } from "./actions/wait";
import { injectEditor } from "./embed";

function getType(extension: string) {
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "jpeg";
    case "png":
      return "png";
    case "webm":
      return "webm";
    default:
      throw new Error(`Unsupported extension "${extension}"`);
  }
}

export function getAsset(file: string): Asset {
  let input = file;
  let path = file;
  if (file.endsWith(".ts")) {
    path = file.slice(0, -3);
  } else {
    input = `${file}.ts`;
  }
  const extension = path.slice(path.lastIndexOf(".") + 1);
  const type = getType(extension);
  return { input, path, extension, type };
}

function getActions(file: string): Action[] {
  const output = spawnSync("bun", [file]);
  return output.stdout
    .toString()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Action);
}

function getOutput(file: string): Output {
  const asset = getAsset(file);
  const actions = getActions(asset.input);
  return {
    ...asset,
    ...defaultOutput,
    actions,
  };
}

const handlers = {
  goto,
  set,
  login,
  trim,
  wait,
  say,
  hover,
  click,
  fill,
  screenshot,
  scroll,
};

export type Action = ArgsUnion<typeof handlers>;
export type ActionType = Action["action"];

export type ActionHandlers = {
  [K in ActionType]: (
    ctx: ActionContext,
    action: Extract<Action, { action: K }>
  ) => Promise<void>;
};

export type ActionCreator = {
  [K in ActionType]: (
    ...args: Extract<Action, { action: K }>["args"]
  ) => ActionCreator;
};

export const page = new Proxy(handlers as unknown as ActionCreator, {
  get: (target, action) => {
    return (...args: any[]) => {
      console.log(JSON.stringify({ action, args }));
      return page;
    };
  },
});

export default page;

// async function getPlaywrightContext(
//   ctx: Partial<PlaywrightContext>,
//   asset: Asset
// ) {
//   const browser = ctx.browser ?? (await chromium.launch({ headless: false }));
//   const context =
//     ctx.context ??
//     (await browser.newContext({
//       deviceScaleFactor: 2,
//       recordVideo: asset.type === "webm" ? { dir: "./.docs/temp" } : undefined,
//     }));
//   const page = ctx.page ?? (await context.newPage());
//   return { browser, context, page };
// }

function findConfig(file: string) {
  const dir = path.dirname(file);
  const config = path.join(dir, "webget.json");
  if (fs.existsSync(config)) {
    return JSON.parse(fs.readFileSync(config, "utf8"));
  }
  if (dir === "/" || dir === ".") {
    return {};
  }
  return findConfig(dir);
}

type Options = {
  debug?: boolean;
  headless?: boolean;
};

export async function generateFiles(
  files: string[],
  { debug = false }: Options
) {
  const browser = await chromium.launch({ headless: !debug, timeout: 5000 });
  const context = await browser.newContext({
    deviceScaleFactor: 2,
  });
  context.setDefaultTimeout(5000);
  const page = await context.newPage();
  const state: ActionState = { session: null };
  // page setup
  await injectEditor(page);
  await page.goto("about:blank");

  for (const file of files) {
    const output = getOutput(file);
    console.log(colors.yellow(output.input));

    const ctx = { browser, context, page, output, state };
    set(ctx, findConfig(output.path));

    page.on("domcontentloaded", () => {
      page.evaluate((output) => {
        window.output = output;
      }, ctx.output);
    });

    await generateFile(ctx);
  }

  if (!debug) {
    await browser.close();
  }
}

export async function generateFile(ctx: ActionContext) {
  const output = ctx.output;
  const actions = output.actions;
  const start = Date.now();
  if (
    output.type !== "webm" &&
    !actions.some((action) => action.action === "screenshot")
  ) {
    actions.push({ action: "screenshot", args: [{}] });
  }

  const onAction = async (action: Action) =>
    ctx.page.evaluateHandle((action) => {
      window.onAction && window.onAction(action);
    }, action);

  for (const action of output.actions) {
    try {
      // @ts-ignore
      await handlers[action.action](ctx, ...action.args);
      await onAction(action);
    } catch (e) {
      throw e;
    }
  }

  if (output.type === "webm") {
    await trim(ctx, { type: "out" });

    const duration = Date.now() - start;
    await ctx.page.close();
    await ctx.context.close();

    const video = ctx.page.video();
    await video?.saveAs(output.path);

    const inTime = formatTime(output.trimLeft - start);
    const outTime = formatTime(output.trimRight - start);

    console.log(`Trimming video from ${inTime} to ${outTime}`);
    const result = spawnSync(
      "ffmpeg",
      `-y -i ${output.path} -ss ${inTime} -to ${outTime} -c:v copy -c:a copy ${output.path}.clip.webm`.split(
        " "
      )
    );
    console.log(result.stdout.toString());
  } else {
    if (!actions.some((action) => action.action === "screenshot")) {
      await screenshot(ctx, {});
    }
  }
}

// format milliseconds to HH:MM:SS.mmm without using Date
function formatTime(ms: number) {
  const milliseconds = ms % 1000;
  const seconds = ((ms - milliseconds) / 1000) % 60;
  const minutes = ((ms - seconds * 1000 - milliseconds) / 60000) % 60;
  const hours =
    (ms - minutes * 60000 - seconds * 1000 - milliseconds) / 3600000;
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds)}`;
}

export function logStart(action: string, ...args: any[]) {
  const start = Date.now();
  const command = colors.bold.blue(action) + " " + print(args);
  const spinner = ora(command).start();
  return { action, args, spinner, start };
}

export function logComplete(options: ReturnType<typeof logStart>) {
  const command = colors.bold.blue(options.action) + " " + print(options.args);
  const time = Date.now() - options.start;
  return options.spinner.succeed(command + " " + colors.dim(`(${time}ms)`));
}

export function print(obj: any) {
  if (Array.isArray(obj)) {
    let output = "";
    for (const item of obj) {
      output += print(item);
    }
    return output;
  }
  if (typeof obj === "object") {
    let first = true;
    let output = colors.dim("[");
    for (const [key, value] of Object.entries(obj)) {
      if (!first) output += " ";
      first = false;
      output += colors.gray(key + ":") + print(value);
    }
    return output + colors.dim("]");
  }
  if (typeof obj === "string") {
    return colors.cyan(`${obj}`);
  }
  if (typeof obj === "number") {
    return colors.red(`${obj}`);
  }
  return String(obj);
}
