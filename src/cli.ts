import { hc } from "hono/client";
import { Listr } from "listr2";
import { existsSync } from "node:fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { SERVER_URL } from "./constants";
import { getAsset } from "./schema";
import type { ScreenshotOutcome } from "./screenshot";
import { runServer, type API } from "./server";

const api = hc<API>(SERVER_URL);

function getOutput(input: string) {
  return input.replace(".json", "");
}

function getRelative(path: string) {
  return path.replace(process.cwd() + "/", "");
}

type TaskStatus =
  | "waiting"
  | "loading"
  | "created"
  | "updated"
  | "matched"
  | "error";

function getStatusEmoji(status: TaskStatus) {
  switch (status) {
    case "waiting":
      return "";
    case "loading":
      return "";
    case "created":
      return "✨";
    case "updated":
      return "🔄";
    case "matched":
      return "";
    case "error":
      return "❌";
  }
}

function getTaskTitle(path: string, result?: ScreenshotOutcome) {
  let relative = getRelative(path);
  if (!result) return relative;

  const emoji = getStatusEmoji(result.status);
  if (result.status === "error") {
    relative = getRelative(path + ".json");
    return `${relative} ${emoji} ${result.error}`;
  }
  return `${relative} ${emoji}`;
}

yargs(hideBin(process.argv))
  .scriptName("webget")
  .command(
    "update",
    "Update screenshots in current directory",
    (yargs) =>
      yargs
        .option("filter", { type: "string" })
        .describe("filter", "Only generate screenshots containing filter")

        .option("workers", { type: "number" })
        .describe("workers", "The number of screenshots to generate at once")
        .default("workers", 8)

        .boolean("headed")
        .describe("headed", "Show browser during capture")

        .boolean("diff")
        .describe("diff", "Show browser during capture"),

    async ({ filter, workers, headed, diff }) => {
      await startServer();

      const outputs = [
        ...new Bun.Glob("**/*.{png,jpg}.json").scanSync({ absolute: true }),
      ]
        .filter((input) => !filter || input.includes(filter))
        .map(getOutput);

      outputs.sort();

      const tasks = new Listr(
        outputs.map((output) => ({
          title: getTaskTitle(output),
          task: async (ctx, task) => {
            const result = await getScreenshot(output, headed, diff);
            task.title = getTaskTitle(output, result);
          },
          exitOnError: false,
        })),
        { concurrent: workers }
      );

      await tasks.run();
    }
  )
  .command(
    "start",
    "Start the server",
    () => ({}),
    async () => {
      await startServer(true);
    }
  )
  .command(
    "stop",
    "Stop the server",
    () => ({}),
    async () => {
      await stopServer(true);
    }
  )
  .command(
    "server",
    "Run the server",
    () => ({}),
    async () => {
      await stopServer();
      const path = getHome();
      process.chdir(path);
      runServer();
    }
  )
  .parse();

async function isServerRunning() {
  try {
    const res = await api.health.$get();
    return res.ok;
  } catch (e) {
    return false;
  }
}

export function getHome() {
  if (existsSync("./node_modules/webgets")) {
    return "./node_modules/webgets";
  }
  return "./";
}

async function startServer(log = false) {
  const running = await isServerRunning();
  if (running) {
    if (log) console.log("Server running");
  } else {
    const path = getHome();
    const proc = Bun.spawn([`${path}/bin/webget`, "server"], {
      cwd: path,
      stdout: "ignore",
      stderr: "ignore",
    });
    proc.unref();
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (log) console.log("Server started");
  }
}

async function stopServer(log = false) {
  const running = await isServerRunning();
  if (running) {
    await api.stop.$get();
    if (log) console.log("Server stopped");
  } else {
    if (log) console.log("Server not running");
  }
}

async function getScreenshot(path: string, headed = false, diff = false) {
  const asset = await getAsset(path, headed, diff);
  const res = await api.update.$post({ json: asset });

  if (!res.ok) {
    return { status: "error" as const, error: "Newtwork error" };
  }

  const result = await res.json();

  if (result.status === "created" || result.status === "updated") {
    const image = await fetch(result.path);
    await Bun.write(asset.output, image);
  }

  return result;
}
