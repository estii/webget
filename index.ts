#! /usr/bin/env bun

import { treaty } from "@elysiajs/eden";
import { Glob } from "bun";
import Listr from "listr";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { SERVER_URL } from "./constants";
import type { App, ScreenshotResult } from "./server";

const app = treaty<App>(SERVER_URL);

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

function getTaskTitle(path: string, result?: ScreenshotResult) {
  let relative = getRelative(path);
  if (!result) return relative;

  if (result.error) {
    relative = getRelative(path + ".json");
  }
  const emoji = getStatusEmoji(result.status);
  return `${relative} ${emoji} ${result.error ?? ""}`;
}

yargs(hideBin(process.argv))
  .scriptName("wg")
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
        ...new Glob("**/*.{png,jpg}.json").scanSync({ absolute: true }),
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
  .parse();

async function isServerRunning() {
  try {
    const res = await app.health.get();
    return !res.error;
  } catch (e) {
    return false;
  }
}

async function startServer(log = false) {
  const running = await isServerRunning();
  if (running) {
    if (log) console.log("Server running");
  } else {
    const proc = Bun.spawn(["bun", "--watch", "server.ts"], {
      cwd: import.meta.dir,
    });
    proc.unref();
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (log) console.log("Server started");
  }
}

async function stopServer(log = false) {
  const running = await isServerRunning();
  if (running) {
    const res = await app.stop.get();
    if (log) console.log("Server stopped");
  } else {
    if (log) console.log("Server not running");
  }
}

async function getScreenshot(path: string, headed = false, diff = false) {
  const { data, error } = await app.screenshot.get({
    query: { path, headed, diff },
  });
  if (error) {
    return { status: "error" as const, error: "Newtwork error" };
  }
  return data;
}
