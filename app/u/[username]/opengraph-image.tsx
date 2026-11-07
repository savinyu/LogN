import { ImageResponse } from "next/og";
import type { PlatformId } from "@/lib/adapters/types";
import { getDashboardData, getPublicProfile } from "@/lib/dashboard/queries";
import { PLATFORM_META } from "@/lib/platforms";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "LogN profile";

// Literal colors on purpose: ImageResponse can't read CSS variables, and the image is rendered for
// social previews outside any theme. These are the v2 light-theme tokens from app/globals.css.
// The display font (Bricolage Grotesque) is not loaded: it would need a font file fetched per render.
const COLOR = {
  background: "#fbf8f8",
  foreground: "#2a1f23",
  card: "#f4eeef",
  primary: "#c01f4a",
  primaryForeground: "#ffffff",
  muted: "#6c5c62",
};
const PLATFORM_HEX: Record<PlatformId, string> = {
  codeforces: "#2563eb",
  atcoder: "#0d8a7e",
  leetcode: "#d97706",
  codechef: "#8a5a35",
  code360: "#a21caf",
  hackerrank: "#475467",
  interviewbit: "#4338ca",
  gfg: "#2f8d46",
  cses: "#0284c7",
};

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  const data = profile ? await getDashboardData(profile.userId, { verifiedOnly: true }) : null;
  const total = data?.totals.reduce((sum, t) => sum + t.solved, 0) ?? 0;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: COLOR.background,
        color: COLOR.foreground,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: COLOR.primary }}>
        LogN
      </div>
      {profile && data ? (
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 168,
              height: 168,
              borderRadius: 54,
              background: COLOR.primary,
              color: COLOR.primaryForeground,
              fontSize: 64,
              fontWeight: 700,
            }}
          >
            {profile.name.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>{profile.name}</div>
            <div style={{ display: "flex", fontSize: 40, color: COLOR.muted }}>
              {`${total.toLocaleString("en-US")} problems solved`}
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
              {data.totals
                .filter((t) => t.solved > 0)
                .map((t) => (
                  <div
                    key={t.platform}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 20px",
                      borderRadius: 999,
                      background: COLOR.card,
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        background: PLATFORM_HEX[t.platform],
                      }}
                    />
                    <div style={{ display: "flex", fontSize: 28, fontWeight: 600 }}>
                      {`${PLATFORM_META[t.platform].name} ${t.solved}`}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", fontSize: 56 }}>Profile not found</div>
      )}
      <div style={{ display: "flex", fontSize: 28, color: COLOR.muted }}>{`/u/${username}`}</div>
    </div>,
    size,
  );
}
