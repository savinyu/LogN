"use client";

import { useRef, useState } from "react";
import { cn } from "cn";
import type { PlatformId } from "@/lib/adapters/types";

export interface RatingPoint {
  /** ISO timestamp. */
  at: string;
  rating: number;
  name: string;
  /** Short format label, such as "Div. 2" or "Weekly". */
  format?: string | null;
  rank?: number | null;
  /** Rating change from this contest, when the old rating is known. */
  delta?: number | null;
}

const STROKE: Record<PlatformId, string> = {
  codeforces: "stroke-platform-codeforces",
  atcoder: "stroke-platform-atcoder",
  leetcode: "stroke-platform-leetcode",
  codechef: "stroke-platform-codechef",
  code360: "stroke-platform-code360",
  hackerrank: "stroke-platform-hackerrank",
  interviewbit: "stroke-platform-interviewbit",
  gfg: "stroke-platform-gfg",
  cses: "stroke-platform-cses",
};
const FILL: Record<PlatformId, string> = {
  codeforces: "fill-platform-codeforces",
  atcoder: "fill-platform-atcoder",
  leetcode: "fill-platform-leetcode",
  codechef: "fill-platform-codechef",
  code360: "fill-platform-code360",
  hackerrank: "fill-platform-hackerrank",
  interviewbit: "fill-platform-interviewbit",
  gfg: "fill-platform-gfg",
  cses: "fill-platform-cses",
};

const W = 560;
const H = 210;
const PAD = { l: 42, r: 12, t: 12, b: 24 };

const num = (n: number) => n.toLocaleString("en");
const dateFmt = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const monthFmt = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${num(Math.abs(n))}`;

/**
 * A rating-over-time line (Coach's ratingSVG). Points are oldest first. Scales to its container.
 * Hovering (or tapping) snaps to the nearest contest and shows a card with its details.
 */
export function RatingLine({
  platform,
  points,
  label,
}: {
  platform: PlatformId;
  points: RatingPoint[];
  label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; w: number; h: number } | null>(null);
  if (points.length === 0) return null;
  const times = points.map((p) => Date.parse(p.at));
  const ratings = points.map((p) => p.rating);
  const lo = Math.floor((Math.min(...ratings) - 50) / 100) * 100;
  const hi = Math.ceil((Math.max(...ratings) + 50) / 100) * 100;
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const x = (t: number) =>
    t1 === t0 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

  const grid = Array.from({ length: 5 }, (_, i) => Math.round(lo + (i * (hi - lo)) / 4));
  const px = times.map(x);
  const xs = px.map((v) => v.toFixed(1));
  const coords = points.map((p, i) => `${xs[i]},${y(p.rating).toFixed(1)}`);
  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((idx, i, a) => ({
      idx,
      anchor: a.length === 1 ? "middle" : i === 0 ? "start" : i === a.length - 1 ? "end" : "middle",
    }));

  function track(e: React.PointerEvent) {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const vx = ((e.clientX - box.left) / box.width) * W;
    let i = 0;
    for (let j = 1; j < px.length; j++) {
      if (Math.abs((px[j] ?? 0) - vx) < Math.abs((px[i] ?? 0) - vx)) i = j;
    }
    // On touch a second tap on the same point clears it (pointerleave is ignored for touch).
    if (e.pointerType === "touch" && e.type === "pointerdown" && hover?.i === i)
      return setHover(null);
    setHover({ i, w: box.width, h: box.height });
  }

  const active = hover ? points[hover.i] : undefined;
  const activeT = hover ? (times[hover.i] ?? t0) : t0;
  // The card sits beside the point: to its right on the left half, above it on the lower half.
  const card =
    hover && active
      ? {
          left: (x(activeT) / W) * hover.w,
          top: (y(active.rating) / H) * hover.h,
          flipX: x(activeT) > W / 2,
          flipY: y(active.rating) > H / 2,
        }
      : null;

  return (
    <div
      ref={wrap}
      className="relative"
      onPointerMove={track}
      onPointerDown={track}
      onPointerLeave={(e) => {
        // On touch, pointerleave fires right after pointerup: keep the tapped point shown.
        if (e.pointerType !== "touch") setHover(null);
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
        {grid.map((v) => (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(v)}
              y2={y(v)}
              strokeWidth={1}
              className="stroke-border"
            />
            <text
              x={PAD.l - 6}
              y={y(v) + 3}
              fontSize={10}
              textAnchor="end"
              className="fill-muted-foreground"
            >
              {v}
            </text>
          </g>
        ))}
        {ticks.map(({ idx, anchor }) => (
          <text
            key={idx}
            x={xs[idx]}
            y={H - 6}
            fontSize={10}
            textAnchor={anchor as "start" | "middle" | "end"}
            className="fill-muted-foreground"
          >
            {monthFmt(times[idx] ?? t0)}
          </text>
        ))}
        {hover && active && (
          <line
            x1={xs[hover.i]}
            x2={xs[hover.i]}
            y1={PAD.t}
            y2={H - PAD.b}
            strokeWidth={1}
            strokeDasharray="3 3"
            className="stroke-muted-foreground"
          />
        )}
        {points.length > 1 && (
          <polyline
            points={coords.join(" ")}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className={STROKE[platform]}
          />
        )}
        {points.map((p, i) => {
          const last = i === points.length - 1;
          const on = hover?.i === i;
          return (
            <circle
              key={`${p.at}-${i}`}
              cx={xs[i]}
              cy={y(p.rating)}
              r={on ? 5 : last ? 4 : 2.5}
              strokeWidth={1.5}
              className={
                last || on
                  ? `${FILL[platform]} ${STROKE[platform]}`
                  : `fill-card ${STROKE[platform]}`
              }
            />
          );
        })}
      </svg>
      {card && active ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute z-10 grid w-max max-w-64 gap-1.5 rounded-row bg-popover px-3 py-2 text-xs text-popover-foreground shadow-pop",
            card.flipX && "-translate-x-full",
            card.flipY && "-translate-y-full",
          )}
          style={{
            left: card.left + (card.flipX ? -12 : 12),
            top: card.top + (card.flipY ? -8 : 8),
          }}
        >
          <div className="grid gap-0.5">
            <span className="font-semibold [overflow-wrap:anywhere]">{active.name}</span>
            <span className="text-muted-foreground">
              {active.format ? `${active.format} · ` : ""}
              {dateFmt(activeT)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-muted-foreground">Rating</span>
            <span className="font-mono font-medium tabular-nums">{num(active.rating)}</span>
            {active.delta != null && (
              <span
                className={cn(
                  "font-mono font-semibold tabular-nums",
                  active.delta >= 0 ? "text-good" : "text-primary-ink",
                )}
              >
                {signed(active.delta)}
              </span>
            )}
          </div>
          {active.rank != null && (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-muted-foreground">Rank</span>
              <span className="font-mono font-medium tabular-nums">{num(active.rank)}</span>
            </div>
          )}
        </div>
      ) : null}
      <ul className="sr-only">
        {points.map((p, i) => (
          <li key={`${p.at}-${i}`}>
            {[
              p.name,
              p.format,
              dateFmt(times[i] ?? t0),
              `rating ${num(p.rating)}${p.delta != null ? ` (${signed(p.delta)})` : ""}`,
              p.rank != null ? `rank ${num(p.rank)}` : null,
            ]
              .filter(Boolean)
              .join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
