import { describe, expect, it } from "vitest";
import { buildPlatformUpload, NotLoggedInError, utcDay } from "../extension/lib/common.js";
import {
  code360,
  parseSolvedPage,
  parseUserDetails,
  problemSlug,
} from "../extension/lib/platforms/code360.js";
import {
  codechef,
  collectAccepted,
  parseDailyStats,
  parseRecentPage,
  parseSolvedCount,
  parseSubmissionTime,
} from "../extension/lib/platforms/codechef.js";
import {
  gfg,
  parseProfileInfo,
  parseSubTime,
  parseSubmissions,
} from "../extension/lib/platforms/gfg.js";
import {
  hackerrank,
  isAccepted,
  parseBadgesSolved,
  parseSubmissionHistories,
  parseSubmissionsPage,
} from "../extension/lib/platforms/hackerrank.js";
import {
  interviewbit,
  parseDailySubmissions,
  parseOverview,
  parseProblemListPage,
} from "../extension/lib/platforms/interviewbit.js";
import { cses, parseProblemList } from "../extension/lib/platforms/cses.js";
import { extensionUploadSchema } from "@/lib/extension-upload";
import { isExtensionPlatform } from "@/lib/platforms";
import { fakePage, loadText } from "./extension-helpers";
import { loadFixture } from "./helpers/mock-http";

/** Every upload a reader builds must pass the server's schema and match the platform. */
function expectValidUpload(upload: unknown, platform: string) {
  const parsed = extensionUploadSchema.safeParse(upload);
  expect(parsed.error?.issues).toBeUndefined();
  expect(parsed.success).toBe(true);
  expect((upload as { platform: string }).platform).toBe(platform);
  expect(isExtensionPlatform(platform as never)).toBe(true);
}

describe("GeeksforGeeks", () => {
  const submissions = loadFixture("gfg/submissions-sample.json");
  const info = loadFixture("gfg/user-profile-info.json");

  it("treats user_subtime as India time", () => {
    expect(parseSubTime("2025-03-18 00:30:33")).toBe(Date.UTC(2025, 2, 17, 19, 0, 33) / 1000);
    expect(utcDay(parseSubTime("2025-03-18 00:30:33") ?? 0)).toBe("2025-03-17");
    expect(parseSubTime("garbage")).toBeNull();
    expect(parseSubTime(null)).toBeNull();
  });

  it("parses the solved list with bucket as difficulty and the problem URL", () => {
    const r = parseSubmissions(submissions);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.solves).toHaveLength(7);
    const first = r.solves.find((s) => s.id === "armstrong-numbers2727");
    expect(first).toMatchObject({
      title: "Armstrong Numbers",
      url: "https://www.geeksforgeeks.org/problems/armstrong-numbers2727/1",
      difficulty: "Easy",
      tags: [],
    });
    expect(r.solves.map((s) => s.difficulty)).toEqual(
      expect.arrayContaining(["Easy", "Basic", "Medium", "Hard", "School"]),
    );
  });

  it("keeps the earliest time when a slug repeats across buckets", () => {
    const r = parseSubmissions({
      result: {
        Easy: { "1": { slug: "p", pname: "P", user_subtime: "2024-02-01 10:00:00" } },
        Medium: { "2": { slug: "p", pname: "P", user_subtime: "2024-01-01 10:00:00" } },
      },
    });
    expect(r.ok && r.solves).toHaveLength(1);
    expect(r.ok && r.solves[0]?.solvedAt).toBe(parseSubTime("2024-01-01 10:00:00"));
  });

  it("rejects malformed and unknown-user responses", () => {
    expect(parseSubmissions(null).ok).toBe(false);
    expect(parseSubmissions({ result: "x" }).ok).toBe(false);
    expect(parseSubmissions(loadFixture("gfg/submissions-unknown-user.json"))).toMatchObject({
      ok: true,
      solves: [],
    });
    expect(parseProfileInfo(info)).toBe(7);
    expect(parseProfileInfo(loadFixture("gfg/user-profile-info-unknown.json"))).toBeNull();
    expect(parseProfileInfo(null)).toBeNull();
  });

  it("builds a complete upload when the list matches the total", async () => {
    const page = fakePage({
      identity: ["gfg_user"],
      routes: [
        { match: "problems/submissions/", data: submissions },
        { match: "user-profile-info", data: info },
      ],
    });
    const upload = await gfg.read(page.context(gfg));
    expectValidUpload(upload, "gfg");
    expect(upload).toMatchObject({ loggedInAs: "gfg_user", listComplete: true });
    expect(upload.counts?.total).toBe(7);
    expect(upload.counts?.byDifficulty).toMatchObject({
      Easy: 2,
      Basic: 1,
      Medium: 2,
      Hard: 1,
      School: 1,
    });
    // POST with the handle in the body, then the profile info with the handle in the query
    expect(page.requests[0]?.method).toBe("POST");
    expect(JSON.parse(page.requests[0]?.body ?? "{}")).toMatchObject({ handle: "gfg_user" });
    expect(page.requests[1]?.url).toContain("handle=gfg_user");
  });

  it("marks the list incomplete when the total differs or is unavailable", async () => {
    const page = fakePage({
      identity: ["gfg_user"],
      routes: [
        { match: "problems/submissions/", data: submissions },
        { match: "user-profile-info", data: { data: { total_problems_solved: 170 } } },
      ],
    });
    const upload = await gfg.read(page.context(gfg));
    expect(upload.listComplete).toBe(false);
    expect(upload.counts?.total).toBe(170);

    const noInfo = fakePage({
      identity: ["gfg_user"],
      routes: [
        { match: "problems/submissions/", data: submissions },
        { match: "user-profile-info", status: 400, data: { message: "User not found!" } },
      ],
    });
    const second = await gfg.read(noInfo.context(gfg));
    expect(second.listComplete).toBe(false);
    expect(second.counts?.total).toBe(7);
  });

  it("stops with a login message when no identity is found", async () => {
    const page = fakePage({ identity: [null], routes: [] });
    await expect(gfg.read(page.context(gfg))).rejects.toThrow(
      "Log in to GeeksforGeeks in this browser, then try again.",
    );
    expect(page.requests).toHaveLength(0);
  });

  it("reports a refused list as a login problem", async () => {
    const page = fakePage({ identity: ["x"], routes: [{ match: "submissions", status: 401 }] });
    await expect(gfg.read(page.context(gfg))).rejects.toThrow(/Log in to GeeksforGeeks/);
  });
});

describe("CodeChef", () => {
  const page0 = loadFixture("codechef/recent-user-page0.json");
  const page1 = loadFixture("codechef/recent-user-page1.json");

  it("reads the solved count and daily calendar from the profile HTML", () => {
    expect(parseSolvedCount(loadText("codechef/profile-empty-heatmap.html"))).toBe(632);
    expect(parseSolvedCount("<h3>Total Problems Solved: 1,204</h3>")).toBe(1204);
    expect(parseSolvedCount("<html></html>")).toBeNull();
    // the real page leaves the heatmap array empty
    expect(parseDailyStats(loadText("codechef/profile-empty-heatmap.html"))).toEqual([]);
    // quoted and unquoted keys are both read
    expect(parseDailyStats(loadText("codechef/profile-with-heatmap.html"))).toEqual([
      { day: "2023-12-25", count: 2 },
      { day: "2023-12-20", count: 3 },
      { day: "2024-01-10", count: 1 },
    ]);
  });

  it("parses 'hh:mm AM dd/mm/yy' as India time", () => {
    expect(parseSubmissionTime("11:45 PM 25/12/23")).toBe(Date.UTC(2023, 11, 25, 18, 15) / 1000);
    expect(parseSubmissionTime("12:10 AM 01/02/24")).toBe(Date.UTC(2024, 0, 31, 18, 40) / 1000);
    expect(parseSubmissionTime("12:00 PM 20/12/23")).toBe(Date.UTC(2023, 11, 20, 6, 30) / 1000);
    expect(parseSubmissionTime("yesterday")).toBeNull();
  });

  it("keeps accepted rows only, with the problem code from the link", () => {
    const r = parseRecentPage(page0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rowCount).toBe(4);
    expect(r.maxPage).toBe(1);
    expect(r.rows.map((x) => x.code)).toEqual(["FLOW001", "START01", "TEST"]);
    expect(r.rows[0]).toMatchObject({ title: "Add Two Numbers" });
    expect(r.rows[2]?.title).toBe("Life, the Universe, and Everything");
  });

  it("does not count partial or failed results as accepted", () => {
    const r = parseRecentPage(page1);
    expect(r.ok && r.rows.map((x) => x.code)).toEqual(["FLOW001", "FLOW003"]);
  });

  it("keeps the earliest accepted time per code across pages", () => {
    const map = new Map<string, { title: string; solvedAt: number | null }>();
    for (const p of [page0, page1]) {
      const r = parseRecentPage(p);
      if (r.ok) collectAccepted(map, r.rows);
    }
    expect([...map.keys()].sort()).toEqual(["FLOW001", "FLOW003", "START01", "TEST"]);
    // 12:15 PM 20/12/23 is earlier than 11:45 PM 25/12/23
    expect(map.get("FLOW001")?.solvedAt).toBe(parseSubmissionTime("12:15 PM 20/12/23"));
  });

  it("rejects malformed pages", () => {
    expect(parseRecentPage(null).ok).toBe(false);
    expect(parseRecentPage({ content: 5 }).ok).toBe(false);
    const empty = parseRecentPage(loadFixture("codechef/recent-user-empty.json"));
    expect(empty).toMatchObject({ ok: true, rows: [], rowCount: 0 });
  });

  it("reads every page and builds a valid upload", async () => {
    const page = fakePage({
      identity: ["chef_user"],
      routes: [
        { match: "/users/chef_user", data: loadText("codechef/profile-with-heatmap.html") },
        { match: "page=0", data: page0 },
        { match: "page=1", data: page1 },
      ],
    });
    const upload = await codechef.read(page.context(codechef));
    expectValidUpload(upload, "codechef");
    expect(upload.loggedInAs).toBe("chef_user");
    expect(upload.listComplete).toBe(true);
    expect(upload.counts).toEqual({ total: 7, byDifficulty: {} });
    expect(upload.solves.map((s) => s.id).sort()).toEqual([
      "FLOW001",
      "FLOW003",
      "START01",
      "TEST",
    ]);
    expect(upload.solves.find((s) => s.id === "FLOW001")).toMatchObject({
      url: "https://www.codechef.com/problems/FLOW001",
      difficulty: null,
    });
    expect(upload.activity).toHaveLength(3);
    // profile + two pages, 1500 ms apart
    expect(page.requests.map((r) => r.url)).toEqual([
      "/users/chef_user",
      "/recent/user?user_handle=chef_user&page=0",
      "/recent/user?user_handle=chef_user&page=1",
    ]);
  });

  it("stops on an empty page and caps the pages", async () => {
    const page = fakePage({
      identity: ["chef_user"],
      routes: [
        { match: "/users/", data: "<html></html>" },
        { match: "page=0", data: loadFixture("codechef/recent-user-empty.json") },
      ],
    });
    const upload = await codechef.read(page.context(codechef));
    expect(upload.listComplete).toBe(true);
    expect(upload.solves).toEqual([]);

    // an endless list stops at the page cap and is not complete
    const row = parseRecentPage(page0);
    const endless = fakePage({
      identity: ["chef_user"],
      routes: [
        { match: "/users/", data: "<html></html>" },
        {
          match: "/recent/user",
          data: { content: (page0 as { content: string }).content, max_page: 100000 },
        },
      ],
    });
    expect(row.ok).toBe(true);
    const capped = await codechef.read(endless.context(codechef));
    expect(capped.listComplete).toBe(false);
    expect(endless.requests).toHaveLength(1 + codechef.maxPages);
  });

  it("needs a login", async () => {
    const page = fakePage({ identity: [null], routes: [] });
    await expect(codechef.read(page.context(codechef))).rejects.toThrow(
      "Log in to CodeChef in this browser, then try again.",
    );
  });
});

describe("HackerRank", () => {
  const badges = loadFixture("hackerrank/badges.json");
  const subs = loadFixture("hackerrank/submissions-page1.json");

  it("sums the badges' solved counts", () => {
    expect(parseBadgesSolved(badges)).toBe(202 + 3 + 9 + 115);
    expect(parseBadgesSolved({ models: [] })).toBeNull();
    expect(parseBadgesSolved(null)).toBeNull();
  });

  it("reads submission_histories as day counts and skips junk keys", () => {
    const r = parseSubmissionHistories(loadFixture("hackerrank/submission-histories.json"));
    expect(r).toHaveLength(8);
    expect(r[0]).toMatchObject({ day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(parseSubmissionHistories({ nope: 1, "2024-01-01": 2 })).toEqual([
      { day: "2024-01-01", count: 2 },
    ]);
    expect(parseSubmissionHistories([])).toEqual([]);
  });

  it("filters accepted statuses tolerantly", () => {
    expect(isAccepted("Accepted")).toBe(true);
    expect(isAccepted("accepted ")).toBe(true);
    expect(isAccepted("AC")).toBe(true);
    for (const bad of ["Wrong Answer", "Terminated due to timeout", "Processed", "", null, 1]) {
      expect(isAccepted(bad)).toBe(false);
    }
  });

  it("parses a submissions page: accepted only, slug and name from the challenge", () => {
    const r = parseSubmissionsPage(subs);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.count).toBe(5);
    expect(r.total).toBe(5);
    expect(r.accepted.map((a) => a.slug)).toEqual([
      "solve-me-first",
      "simple-array-sum",
      "solve-me-first",
    ]);
    expect(r.accepted[1]).toMatchObject({ title: "Simple Array Sum", solvedAt: 1700001000 });
    expect(parseSubmissionsPage({}).ok).toBe(false);
  });

  it("builds an upload with the earliest accepted date per challenge", async () => {
    const page = fakePage({
      identity: ["some_hacker"],
      routes: [
        { match: "/badges", data: badges },
        {
          match: "submission_histories",
          data: loadFixture("hackerrank/submission-histories.json"),
        },
        { match: "/submissions/", data: subs },
      ],
    });
    const upload = await hackerrank.read(page.context(hackerrank));
    expectValidUpload(upload, "hackerrank");
    expect(upload.listComplete).toBe(true);
    // a complete list gives the exact count; the badges overlap across domains
    expect(upload.counts).toEqual({ total: 2, byDifficulty: {} });
    expect(upload.solves).toHaveLength(2);
    expect(upload.solves.find((s) => s.id === "solve-me-first")).toMatchObject({
      solvedAt: 1699990000,
      url: "https://www.hackerrank.com/challenges/solve-me-first",
    });
    expect(upload.activity).toHaveLength(8);
    expect(page.requests.at(-1)?.url).toBe("/rest/contests/master/submissions/?offset=0&limit=50");
  });

  it("pages through full submission pages and falls back to the badges total when capped", async () => {
    const full = {
      models: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        status: "Accepted",
        challenge: { name: `C${i}`, slug: `c-${i}` },
        created_at: 1700000000 + i,
      })),
      total: 120,
    };
    const second = {
      models: full.models
        .slice(0, 10)
        .map((m) => ({ ...m, challenge: { name: "X", slug: `d-${m.id}` } })),
      total: 120,
    };
    const page = fakePage({
      identity: ["some_hacker"],
      routes: [
        { match: "/badges", data: badges },
        { match: "submission_histories", status: 404 },
        { match: "offset=0", data: full },
        { match: "offset=50", data: second },
        { match: "offset=60", data: { models: [], total: 120 } },
        { match: "offset=100", data: { models: [], total: 120 } },
      ],
    });
    const upload = await hackerrank.read(page.context(hackerrank));
    expect(upload.solves).toHaveLength(60);
    expect(upload.listComplete).toBe(true);
    expect(upload.activity).toEqual([]);
  });

  it("uploads a real zero for an account with no submissions", async () => {
    const page = fakePage({
      identity: ["some_hacker"],
      routes: [
        { match: "/badges", data: { models: [] } },
        { match: "submission_histories", data: {} },
        { match: "offset=0", data: { models: [], total: 0 } },
      ],
    });
    const upload = await hackerrank.read(page.context(hackerrank));
    expect(upload.loggedInAs).toBe("some_hacker");
    expect(upload.counts?.total).toBe(0);
    expect(upload.solves).toEqual([]);
    expect(upload.listComplete).toBe(true);
  });

  it("needs a login and refuses an unauthorized list", async () => {
    await expect(
      hackerrank.read(fakePage({ identity: [null], routes: [] }).context(hackerrank)),
    ).rejects.toThrow("Log in to HackerRank in this browser, then try again.");
    const page = fakePage({
      identity: ["some_hacker"],
      routes: [
        { match: "/badges", status: 404 },
        { match: "submission_histories", status: 404 },
        { match: "/submissions/", status: 401 },
      ],
    });
    await expect(hackerrank.read(page.context(hackerrank))).rejects.toThrow(/Log in to HackerRank/);
  });
});

describe("InterviewBit", () => {
  const overview = loadFixture("interviewbit/overview-count.json");
  const list = loadFixture("interviewbit/problem-list-page.json");

  it("reads the overview total and difficulty split", () => {
    expect(parseOverview(overview)).toEqual({
      total: 575,
      byDifficulty: { easy: 259, medium: 248, hard: 36, very_easy: 32 },
    });
    expect(parseOverview({})).toBeNull();
    expect(parseOverview(null)).toBeNull();
  });

  it("keeps has_solved problems with difficulty and topic tags", () => {
    const r = parseProblemListPage(list);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.count).toBe(3);
    expect(r.solved.map((s) => s.id)).toEqual([
      "max-sum-contiguous-subarray",
      "reverse-linked-list",
    ]);
    expect(r.solved[0]).toMatchObject({
      title: "Max Sum Contiguous Subarray",
      difficulty: "medium",
      tags: ["Arrays", "Dynamic Programming"],
      url: "https://www.interviewbit.com/problems/max-sum-contiguous-subarray/",
      solvedAt: null,
    });
    expect(r.solved[1]?.tags).toEqual(["Linked Lists"]);
  });

  it("finds nothing solved when logged out, and rejects malformed pages", () => {
    const r = parseProblemListPage(loadFixture("interviewbit/problem-list-page-logged-out.json"));
    expect(r).toMatchObject({ ok: true, count: 2, solved: [] });
    expect(parseProblemListPage({}).ok).toBe(false);
  });

  it("reads the daily calendar", () => {
    const r = parseDailySubmissions(loadFixture("interviewbit/daily-submissions.json"));
    expect(r).toHaveLength(6);
    expect(parseDailySubmissions({})).toEqual([]);
    expect(
      parseDailySubmissions([
        { date: "bad", count: 1 },
        { date: "2024-01-01", count: 4 },
      ]),
    ).toEqual([{ day: "2024-01-01", count: 4 }]);
  });

  it("stops as soon as every counted solve is found, and reads this and last year", async () => {
    const page = fakePage({
      identity: ["ib_user"],
      routes: [
        {
          match: "problems_solved_overview_count",
          data: { total_problems_solved: 2, difficulty_problems_solved: [] },
        },
        { match: "page_offset=0", data: list },
        {
          match: "daily-user-submissions/2025",
          data: loadFixture("interviewbit/daily-submissions.json"),
        },
        { match: "daily-user-submissions/2026", data: [{ date: "2026-10-01", count: 3 }] },
      ],
    });
    const upload = await interviewbit.read(page.context(interviewbit));
    expectValidUpload(upload, "interviewbit");
    expect(upload.listComplete).toBe(true);
    expect(upload.solves).toHaveLength(2);
    expect(upload.activity.at(-1)).toEqual({ day: "2026-10-01", count: 3 });
    expect(page.requests.filter((r) => r.url.includes("page_offset"))).toHaveLength(1);
  });

  it("walks until an empty page and is incomplete when the counts disagree", async () => {
    const page = fakePage({
      identity: ["ib_user"],
      routes: [
        { match: "problems_solved_overview_count", data: overview },
        { match: "page_offset=0", data: list },
        { match: "page_offset=20", data: { items: [] } },
        { match: "daily-user-submissions", status: 404 },
      ],
    });
    const upload = await interviewbit.read(page.context(interviewbit));
    expect(upload.listComplete).toBe(false);
    expect(upload.counts?.total).toBe(575);
    expect(upload.counts?.byDifficulty).toMatchObject({ very_easy: 32 });
    expect(upload.solves).toHaveLength(2);
  });

  it("needs a login", async () => {
    await expect(
      interviewbit.read(fakePage({ identity: [null], routes: [] }).context(interviewbit)),
    ).rejects.toThrow("Log in to InterviewBit in this browser, then try again.");
  });
});

describe("Code360", () => {
  const details = loadFixture("code360/user-details.json");
  const page1 = loadFixture("code360/solved-problems-page1.json");
  const page2 = loadFixture("code360/solved-problems-page2.json");

  it("reads the total and difficulty counts", () => {
    expect(parseUserDetails(details)).toEqual({
      total: 273,
      byDifficulty: { Easy: 178, Moderate: 67, Hard: 28, Ninja: 0 },
    });
    expect(parseUserDetails({})).toBeNull();
    expect(parseUserDetails(loadFixture("code360/solved-unauthorized.json"))).toBeNull();
  });

  it("takes the slug only from coding-problem links", () => {
    expect(problemSlug("/code360/problems/two-sum_8230696")).toBe("two-sum_8230696");
    expect(problemSlug("https://www.naukri.com/code360/problems/x_1/")).toBe("x_1");
    expect(problemSlug("www.codingninjas.com/studio/problems/find-duplicate_625")).toBe(
      "find-duplicate_625",
    );
    expect(problemSlug("/code360/mcq/quiz_12")).toBeNull();
    expect(problemSlug("https://evil.example/code360/problems/x")).toBeNull();
    expect(problemSlug(null)).toBeNull();
  });

  it("parses a page, treating relative or missing times as undated", () => {
    const r = parseSolvedPage(page1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totalPages).toBe(2);
    expect(r.solves.map((s) => s.id)).toEqual([
      "two-sum_8230696",
      "reverse-the-array_1262298",
      "two-sum_8230696",
    ]);
    expect(r.solves[0]?.solvedAt).toBe(Date.parse("2024-03-05T10:20:30+05:30") / 1000);
    expect(r.solves[1]?.solvedAt).toBeNull();
    expect(parseSolvedPage(loadFixture("code360/solved-unauthorized.json")).ok).toBe(false);
  });

  it("reads all pages, dedupes with the earliest date, and builds a valid upload", async () => {
    const page = fakePage({
      identity: ["ab12cd34", "ab12cd34"],
      routes: [
        { match: "user_details", data: details },
        { match: "page=1", data: page1 },
        { match: "page=2", data: page2 },
      ],
    });
    const upload = await code360.read(page.context(code360));
    expectValidUpload(upload, "code360");
    expect(upload.loggedInAs).toBe("ab12cd34");
    expect(upload.listComplete).toBe(true);
    expect(upload.counts?.total).toBe(273);
    expect(upload.solves.map((s) => s.id).sort()).toEqual([
      "find-duplicate_625",
      "reverse-the-array_1262298",
      "two-sum_8230696",
    ]);
    const two = upload.solves.find((s) => s.id === "two-sum_8230696");
    expect(two?.solvedAt).toBe(Date.parse("2024-03-01T08:00:00+05:30") / 1000);
    expect(two?.url).toBe("https://www.naukri.com/code360/problems/two-sum_8230696");
    // identity is read before and after the list
    expect(page.identityCalls).toHaveLength(2);
  });

  it("aborts without an upload if the account changed during the sync", async () => {
    const page = fakePage({
      identity: ["ab12cd34", "someone-else"],
      routes: [
        { match: "user_details", data: details },
        { match: "page=1", data: { data: { total_pages: 1, problem_submissions: [] } } },
      ],
    });
    await expect(code360.read(page.context(code360))).rejects.toThrow(/account changed/);
  });

  it("needs a login, and an unauthorized list reads as a login problem", async () => {
    await expect(
      code360.read(fakePage({ identity: [null], routes: [] }).context(code360)),
    ).rejects.toThrow("Log in to Code360 in this browser, then try again.");
    const page = fakePage({
      identity: ["ab12cd34"],
      routes: [
        { match: "user_details", status: 404 },
        { match: "view_solved_problems", status: 401 },
      ],
    });
    await expect(code360.read(page.context(code360))).rejects.toThrow(/Log in to Code360/);
  });
});

describe("cses", () => {
  const sampleHtml = `
    <h2>Introductory Problems</h2>
    <ul class="task-list">
      <li class="task">
        <a href="/problemset/task/1068">Weird Algorithm</a>
        <span class="detail">183544 / 191610</span>
        <span class="task-score icon full" title="Full score"></span>
      </li>
      <li class="task">
        <a href="/problemset/task/1083">Missing Number</a>
        <span class="detail">165000 / 170000</span>
        <span class="task-score icon zero" title="Zero score"></span>
      </li>
      <li class="task">
        <a href="/problemset/task/1069">Repetitions</a>
        <span class="detail">140000 / 150000</span>
        <span class="task-score icon"></span>
      </li>
    </ul>
    <h2>Sorting and Searching</h2>
    <ul class="task-list">
      <li class="task">
        <a href="/problemset/task/1621">Distinct Numbers</a>
        <span class="detail">120000 / 130000</span>
        <span class="task-score icon full"></span>
      </li>
    </ul>
  `;

  it("parses solved tasks and categorizes them", () => {
    const res = parseProblemList(sampleHtml);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.totalSolved).toBe(2);
    expect(res.byCategory).toEqual({
      "Introductory Problems": 1,
      "Sorting and Searching": 1,
    });
    expect(res.solves).toEqual([
      {
        id: "1068",
        title: "Weird Algorithm",
        url: "https://cses.fi/problemset/task/1068",
        difficulty: "Introductory Problems",
        tags: ["Introductory Problems"],
        solvedAt: null,
      },
      {
        id: "1621",
        title: "Distinct Numbers",
        url: "https://cses.fi/problemset/task/1621",
        difficulty: "Sorting and Searching",
        tags: ["Sorting and Searching"],
        solvedAt: null,
      },
    ]);
  });

  it("fails on an unexpected page missing task links", () => {
    const res = parseProblemList("<html><body>Login required</body></html>");
    expect(res.ok).toBe(false);
  });

  it("reads CSES successfully in page context", async () => {
    const page = fakePage({
      identity: ["12345"],
      routes: [{ match: "problemset/list", data: sampleHtml }],
    });
    const upload = await cses.read(page.context(cses));
    expectValidUpload(upload, "cses");
    expect(upload.loggedInAs).toBe("12345");
    expect(upload.listComplete).toBe(true);
    expect(upload.counts?.total).toBe(2);
    expect(upload.solves).toHaveLength(2);
  });
});

describe("uploads", () => {
  it("a counts-only upload (no list) is valid", () => {
    const upload = buildPlatformUpload({
      platform: "interviewbit",
      loggedInAs: "u",
      counts: { total: 10, byDifficulty: { easy: 10 } },
      solves: [],
      listComplete: false,
      activity: [],
    });
    expectValidUpload(upload, "interviewbit");
  });
});

describe("no logged-in user", () => {
  // platform-job.js retries a NotLoggedInError in a fresh tab, so a stale tab isn't the answer.
  it.each([codechef, code360, hackerrank, interviewbit, gfg, cses])(
    "$name throws NotLoggedInError",
    async (reader) => {
      await expect(
        reader.read(fakePage({ identity: [null], routes: [] }).context(reader)),
      ).rejects.toBeInstanceOf(NotLoggedInError);
    },
  );

  it("a refused request is not a missing login", async () => {
    const page = fakePage({
      identity: ["some_hacker"],
      routes: [
        { match: "/badges", status: 404 },
        { match: "submission_histories", status: 404 },
        { match: "/submissions/", status: 401 },
      ],
    });
    const err = await hackerrank.read(page.context(hackerrank)).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(NotLoggedInError);
  });
});
