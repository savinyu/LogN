// Pure per-platform metadata. No server-only or alias imports, so tests and client code can use it.

import type { ExtensionPlatformId, PlatformId, SyncedPlatformId } from "./adapters/types";

export interface PlatformMeta {
  id: PlatformId;
  name: string;
  /** Two to four letters for tight spots (chips, chart legends). */
  short: string;
  profileUrl(handle: string): string;
  handleHint: string;
  handlePattern: RegExp;
  /** server = synced by an adapter; extension = only the browser extension reads it (PLAN-v2.md §9). */
  source: "server" | "extension";
  /** What a sync can see: every solve, counts plus recent solves, or counts only. */
  history: "full" | "recent_only" | "counts_only";
  /** Short caveat shown on the platform's card. */
  note?: string;
}

const enc = encodeURIComponent;

export const PLATFORM_META: Record<PlatformId, PlatformMeta> = {
  codeforces: {
    id: "codeforces",
    name: "Codeforces",
    short: "CF",
    profileUrl: (handle) => `https://codeforces.com/profile/${enc(handle)}`,
    handleHint: "tourist",
    handlePattern: /^[A-Za-z0-9_.-]{3,24}$/,
    source: "server",
    history: "full",
  },
  atcoder: {
    id: "atcoder",
    name: "AtCoder",
    short: "AC",
    profileUrl: (handle) => `https://atcoder.jp/users/${enc(handle)}`,
    handleHint: "chokudai",
    handlePattern: /^[A-Za-z0-9_]{3,16}$/,
    source: "server",
    history: "full",
  },
  leetcode: {
    id: "leetcode",
    name: "LeetCode",
    short: "LC",
    profileUrl: (handle) => `https://leetcode.com/u/${enc(handle)}/`,
    handleHint: "your-leetcode-username",
    handlePattern: /^[A-Za-z0-9_-]{1,30}$/,
    source: "server",
    history: "recent_only",
    note: "LeetCode only shares counts and your 20 most recent solves publicly.",
  },
  codechef: {
    id: "codechef",
    name: "CodeChef",
    short: "CC",
    profileUrl: (handle) => `https://www.codechef.com/users/${enc(handle)}`,
    handleHint: "your-codechef-username",
    handlePattern: /^[A-Za-z0-9_.]{2,40}$/,
    source: "extension",
    history: "counts_only",
  },
  code360: {
    id: "code360",
    name: "Code360",
    short: "C360",
    profileUrl: (handle) => `https://www.naukri.com/code360/profile/${enc(handle)}`,
    handleHint: "your-code360-profile-id",
    handlePattern: /^[A-Za-z0-9_-]{1,64}$/,
    source: "extension",
    history: "counts_only",
  },
  hackerrank: {
    id: "hackerrank",
    name: "HackerRank",
    short: "HR",
    profileUrl: (handle) => `https://www.hackerrank.com/profile/${enc(handle)}`,
    handleHint: "your-hackerrank-username",
    handlePattern: /^[A-Za-z0-9_.-]{1,40}$/,
    source: "extension",
    history: "counts_only",
  },
  interviewbit: {
    id: "interviewbit",
    name: "InterviewBit",
    short: "IB",
    profileUrl: (handle) => `https://www.interviewbit.com/profile/${enc(handle)}/`,
    handleHint: "your-interviewbit-username",
    handlePattern: /^[A-Za-z0-9_.-]{1,60}$/,
    source: "extension",
    history: "counts_only",
  },
  gfg: {
    id: "gfg",
    name: "GeeksforGeeks",
    short: "GFG",
    profileUrl: (handle) => `https://www.geeksforgeeks.org/profile/${enc(handle)}`,
    handleHint: "your-gfg-username",
    handlePattern: /^[A-Za-z0-9_.-]{1,60}$/,
    source: "extension",
    history: "full",
  },
  cses: {
    id: "cses",
    name: "CSES",
    short: "CSES",
    profileUrl: (handle) => `https://cses.fi/user/${enc(handle)}`,
    handleHint: "your-cses-user-id",
    handlePattern: /^[A-Za-z0-9_.-]{1,30}$/,
    source: "extension",
    history: "full",
  },
};

/** Display order: the server-synced platforms, then the extension ones. */
export const PLATFORM_ORDER: PlatformId[] = [
  "codeforces",
  "atcoder",
  "leetcode",
  "codechef",
  "code360",
  "hackerrank",
  "interviewbit",
  "gfg",
  "cses",
];

export function isSyncedPlatform(platform: PlatformId): platform is SyncedPlatformId {
  return PLATFORM_META[platform].source === "server";
}

export function isExtensionPlatform(platform: PlatformId): platform is ExtensionPlatformId {
  return PLATFORM_META[platform].source === "extension";
}

/**
 * A handle short enough to show in a tile or pill. Code360's handle is a profile UUID, so it shows
 * the first 8 characters; callers keep the full handle in the link and its title.
 */
export function displayHandle(platform: PlatformId, handle: string): string {
  if (platform === "code360" && handle.length > 12) return `${handle.slice(0, 8)}…`;
  return handle;
}

/** "across 6 platforms" for a total tile's sub line. */
export function acrossPlatforms(count: number): string {
  return `across ${count} ${count === 1 ? "platform" : "platforms"}`;
}
