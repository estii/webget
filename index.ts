#! /usr/bin/env bun

import { Glob } from "bun";
import Listr from "listr";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";
import { SERVER_URL } from "./constants";

function getOutput(input: string) {
  return input.replace(".json", "");
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

function getTaskTitle(output: string, result: ScreenshotResult) {
  const emoji = getStatusEmoji(result.status);
  return `${output} ${emoji} ${result.error ?? ""}`;
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
      const outputs = [
        ...new Glob("**/*.{png,jpg}.json").scanSync({ absolute: true }),
      ]
        .filter((input) => !filter || input.includes(filter))
        .map(getOutput);

      const tasks = new Listr(
        outputs.map((output) => ({
          title: output,
          task: async (ctx, task) => {
            const result = await getScreenshot(output);
            task.title = getTaskTitle(output, result);
          },
        })),
        { concurrent: workers }
      );

      await tasks.run();
    }
  )
  .parse();

const ScreenshotResult = z.object({
  status: z.enum(["created", "updated", "matched", "error"]),
  error: z.string().optional(),
});

type ScreenshotResult = z.infer<typeof ScreenshotResult>;

async function getScreenshot(path: string) {
  const res = await fetch(`${SERVER_URL}/screenshot?path=${path}`);
  if (res.status !== 200) {
    return { status: "error" as const, error: "Newtwork error" };
  }
  return ScreenshotResult.parse(await res.json());
}
