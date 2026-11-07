import { describe, expect, it } from "vitest";
import { oldestSubmissionTime, parseProblemsAll } from "../extension/lib/leetcode.js";
import { SYNC_PLATFORMS } from "../extension/lib/registry.js";
import {
  DAILY_INTERVAL_MS,
  VISIT_INTERVAL_MS,
  VISIT_RETRY_MS,
  isDue,
  leetcodeDatesSince,
  nextRun,
  platformForUrl,
  skipsRemoved,
  type RunRecord,
} from "../extension/lib/schedule.js";
import { loadFixture } from "./helpers/mock-http";

const NOW = Date.UTC(2026, 9, 19, 12);
const HOUR = 3_600_000;

function run(over: Partial<RunRecord>): RunRecord {
  return { at: NOW, okAt: NOW, ok: true, loggedOut: false, auto: true, text: "", ...over };
}

describe("isDue", () => {
  it("is due with no run yet", () => {
    expect(isDue(undefined, NOW, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(true);
  });

  it("waits for the interval after a success", () => {
    const r = run({ at: NOW - 5 * HOUR, okAt: NOW - 5 * HOUR });
    expect(isDue(r, NOW, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(false);
    expect(isDue(r, NOW + HOUR, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(true);
  });

  it("retries a failure after the retry delay, not the full interval", () => {
    const r = run({ at: NOW - 5 * 60_000, okAt: null, ok: false });
    expect(isDue(r, NOW, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(false);
    expect(isDue(r, NOW + 5 * 60_000, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(true);
  });

  it("retries a logged-out visit after a minute, not ten", () => {
    const r = run({ at: NOW - 61_000, okAt: null, ok: false, loggedOut: true });
    expect(isDue(r, NOW, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(true);
    expect(isDue({ ...r, at: NOW - 30_000 }, NOW, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(false);
  });

  it("an old success with a recent failed attempt waits for the retry delay", () => {
    const r = run({ at: NOW - 60_000, okAt: NOW - 30 * HOUR, ok: false });
    expect(isDue(r, NOW, DAILY_INTERVAL_MS, HOUR)).toBe(false);
  });
});

describe("nextRun", () => {
  it("keeps the last success time when a run fails", () => {
    const prev = run({ okAt: NOW - HOUR });
    const next = nextRun(prev, { now: NOW, ok: false, loggedOut: true, auto: true, text: "x" });
    expect(next).toMatchObject({ at: NOW, okAt: NOW - HOUR, ok: false, loggedOut: true });
    expect(nextRun(undefined, { now: NOW, ok: true, auto: false, text: "y" })).toMatchObject({
      okAt: NOW,
      loggedOut: false,
    });
  });
});

describe("skipsRemoved", () => {
  const me = { handles: { codeforces: { handle: "savinyu" } }, removed: ["leetcode", "gfg"] };

  it("skips a removed platform on an automatic run only", () => {
    expect(skipsRemoved(me, "leetcode", false)).toBe(true);
    expect(skipsRemoved(me, "gfg", false)).toBe(true);
    expect(skipsRemoved(me, "leetcode", true)).toBe(false);
  });

  it("runs platforms that weren't removed, or are connected again", () => {
    expect(skipsRemoved(me, "codechef", false)).toBe(false);
    expect(skipsRemoved({ ...me, removed: ["codeforces"] }, "codeforces", false)).toBe(false);
  });

  it("runs everything when LogN doesn't send `removed` (an older server)", () => {
    expect(skipsRemoved({ handles: {} }, "leetcode", false)).toBe(false);
    expect(skipsRemoved(null, "leetcode", false)).toBe(false);
  });

  it("records a skip without counting it as a sync, so a handle added back syncs soon", () => {
    const prev = run({ okAt: NOW - 30 * HOUR });
    const next = nextRun(prev, { now: NOW, ok: true, auto: true, text: "x", skipped: true });
    expect(next).toMatchObject({ ok: true, okAt: NOW - 30 * HOUR, skipped: true });
    // Not checked again on every visit, but due after the retry delay, not 6 hours.
    expect(isDue(next, NOW + 60_000, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(false);
    expect(isDue(next, NOW + VISIT_RETRY_MS, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(true);
  });
});

describe("nextRun datesAt", () => {
  it("sets datesAt only when the date walk completed, else carries it over", () => {
    const base = { now: NOW, ok: true, auto: true, text: "" };
    expect(nextRun(undefined, { ...base, datesDone: true }).datesAt).toBe(NOW);
    expect(nextRun(undefined, base).datesAt).toBeNull();
    const prev = run({ datesAt: NOW - HOUR });
    expect(nextRun(prev, base).datesAt).toBe(NOW - HOUR);
    expect(nextRun(prev, { ...base, ok: false, datesDone: true }).datesAt).toBe(NOW - HOUR);
  });
});

describe("platformForUrl", () => {
  const id = (url: string) => platformForUrl(url, SYNC_PLATFORMS)?.id ?? null;

  it("maps each platform's pages", () => {
    expect(id("https://leetcode.com/problems/two-sum/")).toBe("leetcode");
    expect(id("https://www.codechef.com/practice")).toBe("codechef");
    expect(id("https://www.hackerrank.com/dashboard")).toBe("hackerrank");
    expect(id("https://www.interviewbit.com/practice/")).toBe("interviewbit");
    expect(id("https://www.geeksforgeeks.org/problems/x/1")).toBe("gfg");
    expect(id("https://www.naukri.com/code360/problems/x")).toBe("code360");
    expect(id("https://cses.fi/problemset/list/")).toBe("cses");
  });

  it("ignores naukri.com outside Code360, look-alike hosts and LogN itself", () => {
    expect(id("https://www.naukri.com/jobs-in-pune")).toBeNull();
    expect(id("https://leetcode.com.evil.example/")).toBeNull();
    expect(id("http://localhost:3000/extension/connect")).toBeNull();
    expect(platformForUrl(undefined, SYNC_PLATFORMS)).toBeNull();
  });
});

describe("LeetCode automatic sync", () => {
  it("flags a logged-out problems list", () => {
    const r = parseProblemsAll(loadFixture("leetcode/problems-all-logged-out.json"));
    expect(r).toMatchObject({ ok: false, loggedOut: true });
  });

  it("walks dates back to a day before the last completed walk, or all of them", () => {
    expect(leetcodeDatesSince(undefined)).toBeNull();
    expect(leetcodeDatesSince(run({ datesAt: null }))).toBeNull();
    // a 0.3.3 record has okAt but no datesAt: one full walk
    expect(leetcodeDatesSince(run({ okAt: NOW }))).toBeNull();
    expect(leetcodeDatesSince(run({ datesAt: NOW }))).toBe((NOW - DAILY_INTERVAL_MS) / 1000);
  });

  it("finds the oldest submission on a page", () => {
    const page = {
      submissions_dump: [{ timestamp: 1700000300 }, { timestamp: "1700000100" }, { timestamp: 0 }],
    };
    expect(oldestSubmissionTime(page)).toBe(1700000100);
    expect(oldestSubmissionTime({ submissions_dump: [] })).toBeNull();
    expect(oldestSubmissionTime(null)).toBeNull();
  });
});
