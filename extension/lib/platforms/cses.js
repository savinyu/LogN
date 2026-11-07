// @ts-check
// CSES Problem Set (cses.fi). Identity is the user ID from the header/nav profile link:
//   <a href="/user/[id]">...</a> or <a href="/problemset/user/[id]/">...</a>
// The list of tasks and categories comes from /problemset/list/.
// Tasks containing a score indicator with class "full" inside task-score are solved:
//   <li class="task">
//     <a href="/problemset/task/1068">Weird Algorithm</a>
//     <span class="detail">...</span>
//     <span class="task-score icon full"></span>
//   </li>
import { buildPlatformUpload, NotLoggedInError, ReaderError, stripTags } from "../common.js";

const NAME = "CSES";
const LIST_URL = "https://cses.fi/problemset/list/";

/**
 * Parses the /problemset/list/ HTML.
 * Categories are in <h2>, tasks are in <li class="task">.
 * @param {string} html
 * @returns {{ ok: true, solves: import("../common.js").UploadSolve[], totalSolved: number, byCategory: Record<string, number> } | { ok: false, error: string }}
 */
export function parseProblemList(html) {
  if (!html.includes("/problemset/task/")) {
    return { ok: false, error: `${NAME} sent an unexpected problem list page.` };
  }

  /** @type {import("../common.js").UploadSolve[]} */
  const solves = [];
  /** @type {Record<string, number>} */
  const byCategory = {};
  let totalSolved = 0;

  const tokenRegex =
    /<h2\b[^>]*>([\s\S]*?)<\/h2>|<li\b[^>]*class=["'][^"']*\btask\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  let currentCategory = "General";

  for (const match of html.matchAll(tokenRegex)) {
    if (match[1] !== undefined) {
      currentCategory = stripTags(match[1]).trim() || "General";
      continue;
    }

    const taskHtml = match[2];
    if (!taskHtml) continue;

    const isSolved = /class=["'][^"']*\btask-score\b[^"']*\bfull\b[^"']*["']/i.test(taskHtml);
    if (!isSolved) continue;

    const linkMatch =
      /<a\b[^>]*href=["'](?:\/problemset)?\/task\/([0-9]+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(
        taskHtml,
      );
    if (!linkMatch || !linkMatch[1]) continue;

    const id = linkMatch[1];
    const title = stripTags(linkMatch[2] ?? "").trim() || `Task ${id}`;
    const url = `https://cses.fi/problemset/task/${encodeURIComponent(id)}`;

    totalSolved++;
    byCategory[currentCategory] = (byCategory[currentCategory] ?? 0) + 1;

    solves.push({
      id,
      title,
      url,
      difficulty: currentCategory,
      tags: [currentCategory],
      solvedAt: null,
    });
  }

  return { ok: true, solves, totalSolved, byCategory };
}

/**
 * @param {import("../job.js").ReaderContext} ctx
 * @returns {Promise<import("../common.js").PlatformUpload>}
 */
async function read(ctx) {
  const handle = await ctx.identity();
  if (!handle) throw new NotLoggedInError(`Log in to ${NAME} in this browser, then try again.`);

  ctx.progress("Reading your solved problem list from CSES...");
  const res = await ctx.get(LIST_URL, { as: "text" });
  if (typeof res.data !== "string") {
    throw new ReaderError(`Could not read the problem list from ${NAME}.`);
  }

  const parsed = parseProblemList(res.data);
  if (!parsed.ok) {
    throw new ReaderError(parsed.error);
  }

  return buildPlatformUpload({
    platform: "cses",
    loggedInAs: handle,
    counts: {
      total: parsed.totalSolved,
      byDifficulty: parsed.byCategory,
    },
    solves: parsed.solves,
    listComplete: true,
    activity: [],
  });
}

export const cses = {
  id: "cses",
  name: NAME,
  origin: "https://cses.fi",
  homeUrl: "https://cses.fi/problemset/list/",
  permissions: ["https://cses.fi/*"],
  /** @type {import("../job.js").PageCall[]} */
  identitySteps: [
    { fn: "readLinkHandle", args: ["^/(?:problemset/)?user/([^/?#\\s]+)"] },
    {
      fn: "readSelectorLinkHandle",
      args: ["a[href*='/user/']", "^/(?:problemset/)?user/([^/?#\\s]+)"],
    },
  ],
  read,
};
