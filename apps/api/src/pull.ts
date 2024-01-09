import type {
  PatchOperation,
  PullResponse,
  PullResponseOKV1,
} from "replicache";
import { z } from "zod";
import { searchAgents } from "./agent";
import { searchAssets } from "./asset";
import { getClientGroupForUpdate, searchClients } from "./client";
import { ClientViewData, ClientViewRecord } from "./cvr";
import { searchJobs } from "./job";
import { DB } from "./schema";
import { searchScreenshots } from "./screenshot";
import { searchUsers } from "./user";

const cookie = z.object({
  order: z.number(),
  clientGroupID: z.string(),
});

type Cookie = z.infer<typeof cookie>;

const pullRequest = z.object({
  clientGroupID: z.string(),
  cookie: z.union([cookie, z.null()]),
});

// cvrKey -> ClientViewRecord
const cvrCache = new Map<string, ClientViewRecord>();

export async function pull(
  db: DB,
  userID: string,
  request: Request
): Promise<PullResponse> {
  console.log(`Processing pull`, JSON.stringify(request, null, ""));

  const body = await request.json();
  const pull = pullRequest.parse(body);

  const { clientGroupID } = pull;
  const prevCVR = pull.cookie
    ? cvrCache.get(makeCVRKey(pull.cookie))
    : undefined;

  const baseCVR = prevCVR ?? {
    agent: new ClientViewData(),
    asset: new ClientViewData(),
    job: new ClientViewData(),
    screenshot: new ClientViewData(),
    user: new ClientViewData(),
    clientVersion: 0,
  };
  console.log({ prevCVR, baseCVR });

  const { nextCVRVersion, nextCVR, clientChanges, lists, shares, todos } =
    await (async () => {
      const baseClientGroupRecord = await getClientGroupForUpdate(
        db,
        clientGroupID
      );

      const clientChanges = await searchClients(
        db,
        clientGroupID,
        baseCVR.clientVersion
      );

      console.log({ baseClientGroupRecord, clientChanges });

      const [agents, assets, jobs, screenshots, users] = await Promise.all([
        searchAgents(db),
        searchAssets(db),
        searchJobs(db),
        searchScreenshots(db),
        searchUsers(db),
      ]);

      const nextCVR: ClientViewRecord = {
        agent: ClientViewData.fromSearchResult(agents),
        asset: ClientViewData.fromSearchResult(assets),
        job: ClientViewData.fromSearchResult(jobs),
        screenshot: ClientViewData.fromSearchResult(screenshots),
        user: ClientViewData.fromSearchResult(users),
        clientVersion: baseClientGroupRecord.clientVersion,
      };

      const agentPuts = nextCVR.agent.getPutsSince(baseCVR.agent);
      const assetPuts = nextCVR.asset.getPutsSince(baseCVR.asset);
      const jobPuts = nextCVR.job.getPutsSince(baseCVR.job);
      const screenshotPuts = nextCVR.screenshot.getPutsSince(
        baseCVR.screenshot
      );
      const userPuts = nextCVR.user.getPutsSince(baseCVR.user);

      // Replicache ClientGroups can be forked from an existing
      // ClientGroup with existing state and cookie. In this case we
      // might see a new CG getting a pull with a non-null cookie.
      // For these CG's, initialize to incoming cookie.
      let prevCVRVersion = baseClientGroupRecord.cvrVersion;
      if (prevCVRVersion === null) {
        if (pull.cookie !== null) {
          prevCVRVersion = pull.cookie.order;
        } else {
          prevCVRVersion = 0;
        }
        console.log(
          `ClientGroup ${clientGroupID} is new, initializing to ${prevCVRVersion}`
        );
      }

      const nextClientGroupRecord = {
        ...baseClientGroupRecord,
        cvrVersion: prevCVRVersion + 1,
      };

      console.log({
        agentPuts,
        assetPuts,
        jobPuts,
        screenshotPuts,
        userPuts,
        nextClientGroupRecord,
      });

      const [lists, shares, todos] = await Promise.all([
        getLists(executor, listPuts),
        getShares(executor, sharePuts),
        getTodos(executor, todoPuts),
        putClientGroup(executor, nextClientGroupRecord),
      ]);

      return {
        nextCVRVersion: nextClientGroupRecord.cvrVersion,
        nextCVR,
        clientChanges,
        lists,
        shares,
        todos,
      };
    })();

  console.log({ nextCVRVersion, nextCVR, clientChanges, lists, shares, todos });

  const listDels = nextCVR.list.getDelsSince(baseCVR.list);
  const shareDels = nextCVR.share.getDelsSince(baseCVR.share);
  const todoDels = nextCVR.todo.getDelsSince(baseCVR.todo);

  console.log({ listDels, shareDels, todoDels });

  const patch: PatchOperation[] = [];

  if (prevCVR === undefined) {
    patch.push({ op: "clear" });
  }

  for (const id of listDels) {
    patch.push({ op: "del", key: `list/${id}` });
  }
  for (const list of lists) {
    patch.push({ op: "put", key: `list/${list.id}`, value: list });
  }
  for (const id of shareDels) {
    patch.push({ op: "del", key: `share/${id}` });
  }
  for (const share of shares) {
    patch.push({ op: "put", key: `share/${share.id}`, value: share });
  }
  for (const id of todoDels) {
    patch.push({ op: "del", key: `todo/${id}` });
  }
  for (const todo of todos) {
    patch.push({ op: "put", key: `todo/${todo.id}`, value: todo });
  }

  const respCookie: Cookie = {
    clientGroupID,
    order: nextCVRVersion,
  };
  const resp: PullResponseOKV1 = {
    cookie: respCookie,
    lastMutationIDChanges: Object.fromEntries(
      clientChanges.map((e) => [e.id, e.lastMutationID] as const)
    ),
    patch,
  };

  cvrCache.set(makeCVRKey(respCookie), nextCVR);

  return resp;
}

function makeCVRKey({ order, clientGroupID }: Cookie) {
  return `${clientGroupID}/${order}`;
}
