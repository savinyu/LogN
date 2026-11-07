// Maps each platform's raw difficulty onto problems.difficulty_norm (1 = easiest … 5; null = unrated).
// Bands are our own rough cross-platform equivalents, not official conversions. Each band sits
// inside one Easy / Medium / Hard tier, so the chart and the colored tags agree:
//   1 easy   ≈ CF ≤ 1100      · AtCoder < 400    · LC Easy
//   2 medium ≈ CF 1200–1300   · AtCoder 400–599
//   3 medium ≈ CF 1400–1600   · AtCoder 600–899  · LC Medium
//   4 hard   ≈ CF 1700–2000   · AtCoder 900–1299 · LC Hard
//   5 hard   ≈ CF 2100+       · AtCoder 1300+
// Extension platforms label their problems; each label maps to a band (LABELS below), and
// CodeChef's numeric difficulty rating uses its own cuts.
// Changing a cut means a data migration for stored rows (see 0003_difficulty_bands.sql).
// Pure, so tests and adapters can use it.

import type { PlatformId } from "@/lib/adapters/types";

function band(value: number, cuts: readonly [number, number, number, number]): number {
  const i = cuts.findIndex((cut) => value < cut);
  return i === -1 ? 5 : i + 1;
}

const LEETCODE: Record<string, number> = { easy: 1, medium: 3, hard: 4 };

/** Labels as each extension platform shows them, lower-cased, with spaces and dashes as "_". */
const LABELS: Partial<Record<PlatformId, Record<string, number>>> = {
  leetcode: LEETCODE,
  // GFG's buckets: School, Basic, Easy, Medium, Hard.
  gfg: { school: 1, basic: 1, easy: 1, medium: 3, hard: 4 },
  // Code360: Easy, Moderate, Hard, Ninja.
  code360: { easy: 1, moderate: 3, medium: 3, hard: 4, ninja: 5 },
  // InterviewBit's difficulty_level: very_easy, easy, medium, hard.
  interviewbit: { very_easy: 1, easy: 1, medium: 3, hard: 4 },
  // HackerRank: Easy, Medium, Hard, Advanced, Expert.
  hackerrank: { easy: 1, medium: 3, hard: 4, advanced: 5, expert: 5 },
  // CodeChef's practice labels, when there's no numeric rating.
  codechef: { beginner: 1, easy: 1, medium: 3, hard: 4, challenge: 5 },
  // CSES categories and difficulty labels when given.
  cses: {
    introductory: 1,
    introductory_problems: 1,
    easy: 1,
    sorting_and_searching: 2,
    medium: 3,
    dynamic_programming: 3,
    graph_algorithms: 3,
    tree_algorithms: 3,
    mathematics: 3,
    string_algorithms: 3,
    geometry: 4,
    hard: 4,
    advanced_techniques: 4,
    additional_problems: 4,
    advanced: 5,
  },
};

function labelKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeDifficulty(
  platform: PlatformId,
  raw: string | number | null | undefined,
): number | null {
  if (raw === null || raw === undefined || raw === "") return null;

  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return LABELS[platform]?.[labelKey(String(raw))] ?? null;
  switch (platform) {
    case "codeforces":
      return band(value, [1200, 1400, 1700, 2100]);
    case "atcoder":
      // AtCoder models can be negative (very easy problems); they land in band 1.
      return band(value, [400, 600, 900, 1300]);
    case "codechef":
      // CodeChef's difficulty rating runs on its contest-rating scale (1★ < 1400 … 7★ 2500+).
      return band(value, [1400, 1600, 1900, 2300]);
    default:
      return null;
  }
}

export type DifficultyTier = "easy" | "medium" | "hard";

/** The tier each band (index = band) belongs to. */
export const BAND_TIER: Record<1 | 2 | 3 | 4 | 5, DifficultyTier> = {
  1: "easy",
  2: "medium",
  3: "medium",
  4: "hard",
  5: "hard",
};

/**
 * Easy / Medium / Hard for the colored difficulty tags, read off the band: Codeforces ≤ 1100
 * easy, 1200–1600 medium, ≥ 1700 hard; AtCoder < 400 easy, 400–899 medium, ≥ 900 hard;
 * LeetCode its own labels.
 */
export function difficultyTier(platform: PlatformId, raw: string | null): DifficultyTier | null {
  const band = normalizeDifficulty(platform, raw);
  return band === null ? null : (BAND_TIER[band as keyof typeof BAND_TIER] ?? null);
}

/**
 * The difficulty AtCoder Problems shows: kenkoooo's model values below 400 (often negative) are
 * squashed into (0, 400) so they stay positive. Order is kept, so tiers and bands don't change.
 */
export function displayAtcoderDifficulty(raw: number): number {
  return Math.round(raw >= 400 ? raw : 400 / Math.exp(1 - raw / 400));
}
