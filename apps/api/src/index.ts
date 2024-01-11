import { getNextAgent } from "./agent";
import { assetTable, insertAsset } from "./asset";
import { insertJob, listNextJobs, updateJob } from "./job";
import { getDb } from "./schema";
import { screenshotTable } from "./screenshot";

const MAX_AGENTS = 5;

type Message = {
  type: "run";
  jobId: string;
};

export type Env = {
  DB: D1Database;
  SCREENSHOTS: R2Bucket;
  QUEUE: Queue<Message>;
  BROWSER: any;
  AGENTS: DurableObjectNamespace;
  ASSETS: DurableObjectNamespace;
};

// check for jobs that are waiting and start them
async function sendNextJobs(env: Env) {
  const db = getDb(env);
  const next = await listNextJobs(db, MAX_AGENTS);
  for (const job of next) {
    if (job.status === "waiting") {
      await env.QUEUE.send({ type: "run", jobId: job.id });
      await updateJob(db, { id: job.id, status: "queued" });
      console.log(job.id, "queued");
    }
  }
}

async function createJob(env: Env) {
  const db = getDb(env);
  const asset = await insertAsset(db, "https://estii.com/pricing");
  const job = await insertJob(db, asset.id);
  console.log(job.id, "waiting");
  await sendNextJobs(env);
}

const handler: ExportedHandler<Env, Message> = {
  async fetch(req, env, exe) {
    const url = new URL(req.url);

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 404 });
    }

    if (url.pathname.startsWith("/file/")) {
      const key = url.pathname.slice("/file/".length);
      const obj = await env.SCREENSHOTS.get(key);
      if (!obj) {
        return new Response(null, { status: 404 });
      }
      return new Response(await obj.arrayBuffer(), {
        headers: {
          "Content-Type": "image/png",
        },
      });
    }

    if (url.pathname === "/dump") {
      const db = getDb(env);
      const jobs = await db.query.jobs.findMany();
      const agents = await db.query.agents.findMany();
      const screenshots = await db.query.screenshots.findMany();
      const assets = await db.query.assets.findMany();
      return new Response(
        JSON.stringify({ jobs, agents, assets, screenshots }, null, 2)
      );
    }

    if (url.pathname === "/nuke") {
      const db = getDb(env);
      // await db.delete(jobs.table).run();
      await db.delete(assetTable).run();
      // await db.delete(agents.table).run();
      await db.delete(screenshotTable).run();
      return new Response("Ok");
    }

    await createJob(env);

    return new Response("Ok");
  },
  async queue(batch, env) {
    const db = getDb(env);

    for (const message of batch.messages) {
      const agent = await getNextAgent(db);
      const id = agent
        ? env.AGENTS.idFromString(agent.id)
        : env.AGENTS.newUniqueId();
      const obj = env.AGENTS.get(id);
      const res = await obj.fetch(
        `https://internal.com?jobId=${message.body.jobId}`
      );
      if (!res.ok) {
        throw new Error(`Unexpected response: ${res.status}`);
      }
    }

    await sendNextJobs(env);
  },
};

export { Agent } from "./agent-do";

export default handler;
