import { describe, expect, it } from "vitest";
import { checkHandleFormat } from "../lib/adapters/handle-format";
import { PLATFORM_META } from "../lib/platforms";

async function valid(platform: Parameters<typeof checkHandleFormat>[0], input: string) {
  const res = await checkHandleFormat(platform, input);
  expect(res.result).toBe("valid");
  return res.result === "valid" ? res.canonicalHandle : "";
}

describe("platform patterns", () => {
  it("enforces length and charset bounds", () => {
    const cf = PLATFORM_META.codeforces.handlePattern;
    expect(cf.test("abc")).toBe(true);
    expect(cf.test("a".repeat(24))).toBe(true);
    expect(cf.test("a".repeat(25))).toBe(false);
    expect(cf.test("a.b-c_d")).toBe(true);

    const ac = PLATFORM_META.atcoder.handlePattern;
    expect(ac.test("a".repeat(16))).toBe(true);
    expect(ac.test("a".repeat(17))).toBe(false);
    expect(ac.test("a-b")).toBe(false);

    const lc = PLATFORM_META.leetcode.handlePattern;
    expect(lc.test("a")).toBe(true);
    expect(lc.test("a".repeat(30))).toBe(true);
    expect(lc.test("a".repeat(31))).toBe(false);
    expect(lc.test("a.b")).toBe(false);
  });

  it("marks LeetCode as recent_only with a note", () => {
    expect(PLATFORM_META.leetcode.history).toBe("recent_only");
    expect(PLATFORM_META.leetcode.note).toContain("20 most recent");
    expect(PLATFORM_META.codeforces.history).toBe("full");
  });

  it("builds profile URLs", () => {
    expect(PLATFORM_META.codeforces.profileUrl("tourist")).toBe(
      "https://codeforces.com/profile/tourist",
    );
    expect(PLATFORM_META.atcoder.profileUrl("chokudai")).toBe("https://atcoder.jp/users/chokudai");
    expect(PLATFORM_META.leetcode.profileUrl("neal_wu")).toBe("https://leetcode.com/u/neal_wu/");
  });
});

describe("checkHandleFormat", () => {
  it("accepts valid handles", async () => {
    expect(await valid("codeforces", "tourist")).toBe("tourist");
    expect(await valid("codeforces", "Um_nik.x-y")).toBe("Um_nik.x-y");
    expect(await valid("atcoder", "chokudai")).toBe("chokudai");
    expect(await valid("leetcode", "neal-wu_1")).toBe("neal-wu_1");
    expect(await valid("leetcode", "a")).toBe("a");
  });

  it("rejects too short and too long handles", async () => {
    for (const [p, h] of [
      ["codeforces", "ab"],
      ["codeforces", "a".repeat(25)],
      ["atcoder", "ab"],
      ["atcoder", "a".repeat(17)],
      ["leetcode", "a".repeat(31)],
    ] as const) {
      const res = await checkHandleFormat(p, h);
      expect(res.result).toBe("invalid");
    }
  });

  it("rejects bad characters with a helpful message", async () => {
    const res = await checkHandleFormat("atcoder", "bad-name");
    expect(res.result).toBe("invalid");
    if (res.result === "invalid") expect(res.message).toContain("AtCoder");
    expect((await checkHandleFormat("codeforces", "has space")).result).toBe("invalid");
    expect((await checkHandleFormat("leetcode", "dots.no")).result).toBe("invalid");
  });

  it("rejects empty input", async () => {
    expect((await checkHandleFormat("codeforces", "")).result).toBe("invalid");
    expect((await checkHandleFormat("leetcode", "   ")).result).toBe("invalid");
    expect((await checkHandleFormat("leetcode", "@")).result).toBe("invalid");
  });

  it("trims whitespace and strips a leading @", async () => {
    expect(await valid("codeforces", "  tourist  ")).toBe("tourist");
    expect(await valid("codeforces", "@tourist")).toBe("tourist");
    expect(await valid("atcoder", " @chokudai\n")).toBe("chokudai");
  });

  it("extracts handles from profile URLs", async () => {
    expect(await valid("codeforces", "https://codeforces.com/profile/tourist")).toBe("tourist");
    expect(await valid("codeforces", "codeforces.com/profile/Um_nik?foo=1")).toBe("Um_nik");
    expect(await valid("atcoder", "https://atcoder.jp/users/chokudai")).toBe("chokudai");
    expect(await valid("atcoder", "https://atcoder.jp/users/chokudai/history")).toBe("chokudai");
    expect(await valid("leetcode", "https://leetcode.com/u/neal_wu/")).toBe("neal_wu");
    expect(await valid("leetcode", "https://leetcode.com/neal_wu/")).toBe("neal_wu");
    expect(await valid("leetcode", "  leetcode.com/u/neal_wu  ")).toBe("neal_wu");
    expect(await valid("cses", "https://cses.fi/user/12345")).toBe("12345");
    expect(await valid("cses", "https://cses.fi/problemset/user/12345/")).toBe("12345");
  });

  it("does not treat a URL for another platform as valid", async () => {
    expect(
      (await checkHandleFormat("atcoder", "https://codeforces.com/profile/tourist")).result,
    ).toBe("invalid");
  });
});
