// @ts-check
// The platforms the extension syncs (LeetCode, then the five that are read inside the platform's
// own tab) and the two it only connects and verifies (Codeforces, AtCoder).
import { codechef } from "./platforms/codechef.js";
import { code360 } from "./platforms/code360.js";
import { hackerrank } from "./platforms/hackerrank.js";
import { interviewbit } from "./platforms/interviewbit.js";
import { gfg } from "./platforms/gfg.js";
import { cses } from "./platforms/cses.js";
import { atcoder, codeforces } from "./verifiers.js";

export const READERS = { codechef, code360, hackerrank, interviewbit, gfg, cses };

/** @typedef {"leetcode" | keyof typeof READERS} SyncPlatformId */

/**
 * `visitPrefix`: a page load under it is a visit to the platform (automatic sync).
 * @type {Array<{ id: SyncPlatformId, name: string, kind: "leetcode" | "page", permissions: string[], visitPrefix: string }>}
 */
export const SYNC_PLATFORMS = [
  {
    id: "leetcode",
    name: "LeetCode",
    kind: "leetcode",
    permissions: ["https://leetcode.com/*"],
    visitPrefix: "https://leetcode.com/",
  },
  ...[codechef, code360, hackerrank, interviewbit, gfg, cses].map((r) => ({
    id: /** @type {keyof typeof READERS} */ (r.id),
    name: r.name,
    kind: /** @type {"page"} */ ("page"),
    permissions: r.permissions,
    visitPrefix: /** @type {{ visitPrefix?: string }} */ (r).visitPrefix ?? `${r.origin}/`,
  })),
];

/** @param {unknown} id @returns {id is SyncPlatformId} */
export function isSyncPlatform(id) {
  return SYNC_PLATFORMS.some((p) => p.id === id);
}

/**
 * Codeforces and AtCoder: the server syncs them; the extension only verifies the handle, or
 * connects one, by reading who this browser is logged in as.
 * @type {Array<{ id: "codeforces" | "atcoder", name: string, kind: "verify", permissions: string[], visitPrefix: string }>}
 */
export const VERIFY_PLATFORMS = [codeforces, atcoder].map((v) => ({
  id: v.id,
  name: v.name,
  kind: /** @type {"verify"} */ ("verify"),
  permissions: v.permissions,
  visitPrefix: v.visitPrefix,
}));

/** @param {unknown} id @returns {id is "codeforces" | "atcoder"} */
export function isVerifyPlatform(id) {
  return VERIFY_PLATFORMS.some((p) => p.id === id);
}

/** Every row of the popup, in the order of lib/platforms.ts. */
export const ALL_PLATFORMS = [...VERIFY_PLATFORMS, ...SYNC_PLATFORMS];
