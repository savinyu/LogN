// @ts-check
// Pure helpers shared by the platform readers, the job runner and the tests.
// No `chrome`, no `fetch`, no DOM.

/**
 * The upload the server accepts (mirrors extensionUploadSchema in lib/extension-upload.ts).
 * @typedef {{ id: string, title: string, url: string, difficulty: string | null, tags: string[], solvedAt: number | null }} UploadSolve
 * @typedef {{ total: number, byDifficulty: Record<string, number> }} UploadCounts
 * @typedef {{ day: string, count: number }} UploadDay
 * @typedef {{ platform: string, loggedInAs: string, counts: UploadCounts | null, solves: UploadSolve[], listComplete: boolean, activity: UploadDay[] }} PlatformUpload
 */

/** Where each platform's problem URLs may point (mirrors PROBLEM_HOSTS in lib/extension-upload.ts). */
export const PROBLEM_HOSTS = /** @type {Record<string, string[]>} */ ({
  codechef: ["www.codechef.com", "codechef.com"],
  code360: ["www.naukri.com", "www.codingninjas.com"],
  hackerrank: ["www.hackerrank.com"],
  interviewbit: ["www.interviewbit.com"],
  gfg: ["www.geeksforgeeks.org", "practice.geeksforgeeks.org"],
  cses: ["cses.fi", "www.cses.fi"],
});

const MAX_SOLVES = 10_000;
const MAX_ACTIVITY = 4000;
const MAX_COUNT = 100_000;

/** A human message for the popup. Anything else thrown in a job is shown as a generic error. */
export class ReaderError extends Error {}

/** The platform kept answering 429/403 after the back-off budget (see job.js). */
export class ThrottledError extends ReaderError {}

/**
 * One page of a paginated read. A throttle after the first page returns null: the caller stops
 * and uploads the pages it has, as an incomplete list. On the first page it still throws.
 * @param {{ get: (url: string, opts?: any) => Promise<{ status: number, data: unknown }> }} ctx
 * @param {string} url
 * @param {boolean} first  whether this is the first page
 * @returns {Promise<{ status: number, data: unknown } | null>}
 */
export async function getPage(ctx, url, first) {
  try {
    return await ctx.get(url);
  } catch (e) {
    if (!first && e instanceof ThrottledError) return null;
    throw e;
  }
}

/** The platform tab shows no logged-in user. A tab loaded before the user logged in looks like this. */
export class NotLoggedInError extends ReaderError {}

/** @param {unknown} v @returns {v is Record<string, unknown>} */
export function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** @param {number} ms */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Accepts a handle or id and nothing else. Identity reads happen next to emails and tokens, so
 * anything with an "@", a space or a long string is dropped instead of passed on.
 * @param {unknown} v
 * @returns {string | null}
 */
export function cleanIdentity(v) {
  const s = typeof v === "number" && Number.isFinite(v) ? String(v) : v;
  if (typeof s !== "string") return null;
  const t = s.trim();
  return /^[A-Za-z0-9_.-]{1,64}$/.test(t) ? t : null;
}

/**
 * Walks `path` through nested objects and returns a string or number at the end as a string.
 * @param {unknown} root
 * @param {readonly string[]} path
 * @returns {string | null}
 */
export function pickString(root, path) {
  /** @type {unknown} */
  let cur = root;
  for (const key of path) {
    if (!isRecord(cur)) return null;
    cur = cur[key];
  }
  if (typeof cur === "string") return cur;
  if (typeof cur === "number" && Number.isFinite(cur)) return String(cur);
  return null;
}

/** @param {unknown} v @returns {number | null} a non-negative integer, or null */
export function toCount(v) {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.floor(n), MAX_COUNT);
}

/**
 * Epoch seconds for a wall-clock time in India Standard Time (UTC+05:30, no daylight saving).
 * @param {number} year  four digits
 * @param {number} month 1-12
 * @param {number} day
 * @param {number} [hour]
 * @param {number} [minute]
 * @param {number} [second]
 * @returns {number | null}
 */
export function istToEpoch(year, month, day, hour = 0, minute = 0, second = 0) {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000) - 19_800;
}

/**
 * Parses an epoch (seconds or milliseconds, number or numeric string) or an ISO date string.
 * @param {unknown} v
 * @returns {number | null} epoch seconds
 */
export function toEpochSeconds(v) {
  if (typeof v === "number" || (typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim()))) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n > 1e11 ? n / 1000 : n);
  }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v.trim())) {
    const ms = Date.parse(v.trim());
    return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : null;
  }
  return null;
}

/** @param {number} epochSeconds @returns {string} YYYY-MM-DD in UTC */
export function utcDay(epochSeconds) {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * @param {string} platform
 * @param {string} url
 * @returns {boolean} true when the URL is https on one of the platform's hosts
 */
export function isProblemUrl(platform, url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (PROBLEM_HOSTS[platform] ?? []).includes(u.hostname);
  } catch {
    return false;
  }
}

/** @param {unknown} v @returns {string[]} */
function cleanTags(v) {
  if (!Array.isArray(v)) return [];
  /** @type {Set<string>} */
  const out = new Set();
  for (const t of v) {
    if (typeof t !== "string") continue;
    const s = t.trim();
    if (s !== "" && s.length <= 60) out.add(s);
    if (out.size >= 30) break;
  }
  return [...out];
}

/**
 * Cleans a reader's output into the shape the server validates: one solve per id (the earliest
 * date wins), URLs on the platform's own hosts, bounded strings and numbers, no zero days.
 * @param {{ platform: string, loggedInAs: string, counts?: { total: unknown, byDifficulty?: Record<string, unknown> } | null, solves?: Array<Partial<UploadSolve> & { id: string }>, listComplete?: boolean, activity?: Array<{ day: string, count: number }> }} input
 * @returns {PlatformUpload}
 */
export function buildPlatformUpload(input) {
  /** @type {Map<string, UploadSolve>} */
  const byId = new Map();
  for (const s of input.solves ?? []) {
    const id = String(s.id ?? "").trim();
    const url = String(s.url ?? "");
    if (id === "" || id.length > 200 || !isProblemUrl(input.platform, url) || url.length > 500) {
      continue;
    }
    const title = String(s.title ?? "").trim() || id;
    const solvedAt =
      typeof s.solvedAt === "number" && Number.isInteger(s.solvedAt) && s.solvedAt > 0
        ? s.solvedAt
        : null;
    const difficulty =
      typeof s.difficulty === "string" && s.difficulty.trim() !== ""
        ? s.difficulty.trim().slice(0, 40)
        : null;
    const prev = byId.get(id);
    if (prev) {
      if (solvedAt !== null && (prev.solvedAt === null || solvedAt < prev.solvedAt)) {
        prev.solvedAt = solvedAt;
      }
      continue;
    }
    byId.set(id, {
      id,
      title: title.slice(0, 300),
      url,
      difficulty,
      tags: cleanTags(s.tags),
      solvedAt,
    });
  }
  let solves = [...byId.values()];
  let listComplete = input.listComplete === true;
  if (solves.length > MAX_SOLVES) {
    solves = solves.slice(0, MAX_SOLVES);
    listComplete = false;
  }

  /** @type {UploadCounts | null} */
  let counts = null;
  const total = toCount(input.counts?.total);
  if (input.counts && total !== null) {
    /** @type {Record<string, number>} */
    const byDifficulty = {};
    for (const [label, n] of Object.entries(input.counts.byDifficulty ?? {})) {
      const c = toCount(n);
      const key = label.trim().slice(0, 40);
      if (key !== "" && c !== null) byDifficulty[key] = c;
    }
    counts = { total, byDifficulty };
  }

  /** @type {Map<string, number>} */
  const days = new Map();
  for (const a of input.activity ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.day)) continue;
    const c = toCount(a.count);
    if (c === null || c === 0) continue;
    days.set(a.day, Math.min(c, 10_000));
  }
  const activity = [...days.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-MAX_ACTIVITY)
    .map(([day, count]) => ({ day, count }));

  return {
    platform: input.platform,
    loggedInAs: input.loggedInAs,
    counts,
    solves,
    listComplete,
    activity,
  };
}

/**
 * Returns the response data when it is a usable 200, otherwise throws a short human message.
 * @param {string} name platform display name
 * @param {{ status: number, data: unknown }} res
 * @param {string} what  short description of what was being read
 * @returns {unknown}
 */
export function expectData(name, res, what) {
  if (res.status === 401 || res.status === 403) {
    throw new ReaderError(
      `${name} refused the request for ${what}. Log in to ${name} and try again.`,
    );
  }
  if (res.status !== 200) {
    throw new ReaderError(`${name} returned HTTP ${res.status} while reading ${what}.`);
  }
  if (res.data === null || res.data === undefined) {
    throw new ReaderError(`${name} sent an unexpected response for ${what}.`);
  }
  return res.data;
}

/** @param {string} s @returns {string} */
export function decodeHtml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** @param {string} html @returns {string} text with tags removed and spaces collapsed */
export function stripTags(html) {
  return decodeHtml(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
