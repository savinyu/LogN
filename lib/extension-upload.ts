// The browser extension's upload for the extension-only platforms (CodeChef, Code360, HackerRank,
// InterviewBit, GFG): POST /api/extension/platform. The server never fetches these platforms; the
// extension reads them in the user's own logged-in browser when they click Sync (PLAN-v2.md §9).
// Pure (zod and lib/sync/difficulty only), so the route, the ingest and tests share it.

import { z } from "zod";
import type { ExtensionPlatformId } from "@/lib/adapters/types";
import { EXTENSION_PLATFORMS } from "@/lib/db/schema";
import { BAND_TIER, normalizeDifficulty, type DifficultyTier } from "@/lib/sync/difficulty";

/** Largest platform upload: 10,000 solves with titles and URLs is about 2.5 MB. */
export const MAX_PLATFORM_UPLOAD_BYTES = 3_000_000;

/** Where each platform's problem URLs may point. Anything else is rejected. */
export const PROBLEM_HOSTS: Record<ExtensionPlatformId, readonly string[]> = {
  codechef: ["www.codechef.com", "codechef.com"],
  code360: ["www.naukri.com", "www.codingninjas.com"],
  hackerrank: ["www.hackerrank.com"],
  interviewbit: ["www.interviewbit.com"],
  gfg: ["www.geeksforgeeks.org", "practice.geeksforgeeks.org"],
  cses: ["cses.fi", "www.cses.fi"],
};

/** A real calendar day (YYYY-MM-DD) from 2000 on: rejects 2026-02-31, 2026-13-01, 0000-00-00. */
export const calendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((day) => {
    if (Number(day.slice(0, 4)) < 2000) return false;
    const d = new Date(`${day}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
  }, "Not a real calendar day");

const count = z.number().int().min(0).max(100_000);

const solveSchema = z.object({
  /** The platform's own problem key: GFG slug, CodeChef code, HackerRank challenge slug, … */
  id: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  url: z.url({ protocol: /^https$/ }).max(500),
  /** As the platform labels it ("Medium", "Moderate", "very_easy") or a number as text. */
  difficulty: z.string().trim().min(1).max(40).nullable(),
  /** The platform's topic tags, if it gives any. */
  tags: z.array(z.string().trim().min(1).max(60)).max(30),
  /** First accepted time in epoch seconds, or null when the platform doesn't say. */
  solvedAt: z.number().int().positive().max(4_102_444_800).nullable(),
});

export const extensionUploadSchema = z.object({
  platform: z.enum(EXTENSION_PLATFORMS),
  /**
   * Who the browser is logged in to the platform as (Code360: the profile id). The server
   * checks it against the connected handle, and a match verifies the handle.
   */
  loggedInAs: z.string().trim().min(1).max(200),
  /** The platform's own solved count and its split by difficulty label; null if unavailable. */
  counts: z
    .object({
      total: count,
      byDifficulty: z.record(z.string().trim().min(1).max(40), count),
    })
    .nullable(),
  solves: z.array(solveSchema).max(10_000),
  /** True only when `solves` is the platform's complete solved list. */
  listComplete: z.boolean(),
  /** Per-day submission counts (YYYY-MM-DD, UTC), when the platform has a calendar. */
  activity: z
    .array(
      z.object({
        day: calendarDay,
        count: z.number().int().min(0).max(10_000),
      }),
    )
    .max(4000),
  /** The user clicked this platform in the extension; only then is a removed one connected. */
  manual: z.boolean().optional(),
});

export type ExtensionUpload = z.infer<typeof extensionUploadSchema>;
export type ExtensionUploadSolve = ExtensionUpload["solves"][number];

/** platform_stats kind holding the platform's own counts (one row per account). */
export const EXT_COUNTS_KIND = "ext_counts";

/** Payload of the "ext_counts" stat. `split` is null when no label maps to a tier. */
export interface ExtCounts {
  total: number;
  byDifficulty: Record<string, number>;
  split: Record<DifficultyTier, number> | null;
}

/** Easy / Medium / Hard from the platform's own labels; labels we can't place are left out. */
export function difficultySplit(
  platform: ExtensionPlatformId,
  byDifficulty: Record<string, number>,
): Record<DifficultyTier, number> | null {
  const split: Record<DifficultyTier, number> = { easy: 0, medium: 0, hard: 0 };
  let mapped = false;
  for (const [label, n] of Object.entries(byDifficulty)) {
    const band = normalizeDifficulty(platform, label);
    const tier = band === null ? undefined : BAND_TIER[band as keyof typeof BAND_TIER];
    if (!tier) continue;
    split[tier] += n;
    mapped = true;
  }
  return mapped ? split : null;
}

/** True when the URL is https on one of the platform's hosts. */
export function isPlatformProblemUrl(platform: ExtensionPlatformId, url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && PROBLEM_HOSTS[platform].includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * The URL to store for a problem. GFG's practice pages live under /problems/<slug>/1 and the bare
 * slug is a 404, which extension 0.3.4 and older sent; other URLs are kept as they are.
 */
export function problemUrl(platform: ExtensionPlatformId, url: string): string {
  if (platform !== "gfg") return url;
  const parsed = new URL(url);
  const slug = /^\/problems\/([^/]+)\/?$/.exec(parsed.pathname)?.[1];
  if (!slug) return url;
  parsed.pathname = `/problems/${slug}/1`;
  return parsed.toString();
}
