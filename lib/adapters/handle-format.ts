// Offline handle checks: accepts a pasted profile URL or "@handle", then checks the format.
// lib/adapters/validate.ts runs this first, then asks the platform whether the account exists.
// Keep this file free of server-only and "@/" runtime imports so tests can load it directly.

import { PLATFORM_META } from "../platforms";
import type { PlatformId, ValidateResult } from "./types";

const PROFILE_URL_PATTERNS: Record<PlatformId, RegExp[]> = {
  codeforces: [/^(?:https?:\/\/)?(?:www\.)?codeforces\.com\/profile\/([^/?#\s]+)/i],
  atcoder: [/^(?:https?:\/\/)?(?:www\.)?atcoder\.jp\/users\/([^/?#\s]+)/i],
  leetcode: [
    /^(?:https?:\/\/)?(?:www\.)?leetcode\.com\/u\/([^/?#\s]+)/i,
    /^(?:https?:\/\/)?(?:www\.)?leetcode\.com\/(?!u\/)([^/?#\s]+)/i,
  ],
  codechef: [/^(?:https?:\/\/)?(?:www\.)?codechef\.com\/users\/([^/?#\s]+)/i],
  code360: [
    /^(?:https?:\/\/)?(?:www\.)?naukri\.com\/code360\/profile\/([^/?#\s]+)/i,
    /^(?:https?:\/\/)?(?:www\.)?codingninjas\.com\/(?:studio|codestudio)\/profile\/([^/?#\s]+)/i,
  ],
  hackerrank: [/^(?:https?:\/\/)?(?:www\.)?hackerrank\.com\/(?:profile\/)?([^/?#\s]+)/i],
  interviewbit: [/^(?:https?:\/\/)?(?:www\.)?interviewbit\.com\/profile\/([^/?#\s]+)/i],
  gfg: [
    /^(?:https?:\/\/)?(?:www\.)?geeksforgeeks\.org\/(?:profile|user)\/([^/?#\s]+)/i,
    /^(?:https?:\/\/)?auth\.geeksforgeeks\.org\/user\/([^/?#\s]+)/i,
  ],
  cses: [/^(?:https?:\/\/)?(?:www\.)?cses\.fi\/(?:problemset\/)?user\/([^/?#\s]+)/i],
  cses: [
    /^(?:https?:\/\/)?(?:www\.)?cses\.fi\/(?:problemset\/)?user\/([^/?#\s]+)/i,
  ],
};

function extractHandle(platform: PlatformId, raw: string): string {
  let value = raw.trim();
  for (const pattern of PROFILE_URL_PATTERNS[platform]) {
    const captured = pattern.exec(value)?.[1];
    if (captured !== undefined) {
      try {
        value = decodeURIComponent(captured);
      } catch {
        value = captured;
      }
      break;
    }
  }
  return value.replace(/^@/, "").trim();
}

export async function checkHandleFormat(
  platform: PlatformId,
  rawHandle: string,
): Promise<ValidateResult> {
  const meta = PLATFORM_META[platform];
  const handle = extractHandle(platform, rawHandle);

  if (handle === "") {
    return { result: "invalid", message: `Enter your ${meta.name} handle.` };
  }
  if (!meta.handlePattern.test(handle)) {
    return {
      result: "invalid",
      message: `That doesn't look like a ${meta.name} handle. ${describeRules(platform)}`,
    };
  }
  return { result: "valid", canonicalHandle: handle };
}

function describeRules(platform: PlatformId): string {
  switch (platform) {
    case "codeforces":
      return "Use 3-24 characters: letters, digits, underscores, dots or hyphens.";
    case "atcoder":
      return "Use 3-16 characters: letters, digits or underscores.";
    case "leetcode":
      return "Use 1-30 characters: letters, digits, underscores or hyphens.";
    case "codechef":
      return "Use 2-40 characters: letters, digits, underscores or dots.";
    case "code360":
      return "Paste your Code360 profile URL, or the id at its end.";
    case "hackerrank":
      return "Use 1-40 characters: letters, digits, underscores, dots or hyphens.";
    case "interviewbit":
    case "gfg":
      return "Use 1-60 characters: letters, digits, underscores, dots or hyphens.";
    case "cses":
      return "Enter your CSES user ID or username, or paste your profile URL.";
  }
}
