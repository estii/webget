#! /usr/bin/env bun

import { Glob } from "bun";
import Listr from "listr";
import readline from "readline";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
function getOutput(path: string) {
  return path.replace(".json", "");
}

function updateStatus(lineNumber: number, output: string, status: string) {
  readline.cursorTo(process.stdout, 0, lineNumber);
  readline.clearLine(process.stdout, 1);
  console.log(`${output} ${status}`);
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

function getTaskTitle(input: string, status: TaskStatus) {
  const emoji = getStatusEmoji(status);
  return `${getOutput(input)} ${emoji}`;
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
        .default("workers", 5)

        .boolean("headed")
        .describe("headed", "Show browser during capture"),

    async ({ filter, workers, headed }) => {
      const inputs = [...new Glob("**/*.{png,jpg}.json").scanSync()].filter(
        (input) => !filter || input.includes(filter)
      );

      const tasks = new Listr(
        inputs.map((input) => ({
          title: getTaskTitle(input, "waiting"),
          task: async (ctx, task) => {
            try {
              const res = await fetch(
                "http://localhost:3637/screenshot?path=" + input
              );
              const json = await res.json();
              task.title = getTaskTitle(input, json.action as TaskStatus);
            } catch (error) {
              task.title = getTaskTitle(`${input} ${error}`, "error");
            }
          },
        })),
        { concurrent: workers }
      );

      await tasks.run();
    }
  )
  .parse();
