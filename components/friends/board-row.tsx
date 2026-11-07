import Link from "next/link";
import { cn } from "cn";
import { Chip } from "@/components/kit/chip";
import { UserAvatar } from "@/components/kit/user-avatar";
import type { PlatformId } from "@/lib/adapters/types";
import type { RankedEntry } from "@/lib/friends/points";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";

const SEGMENT: Record<PlatformId, string> = {
  codeforces: "bg-platform-codeforces",
  atcoder: "bg-platform-atcoder",
  leetcode: "bg-platform-leetcode",
  codechef: "bg-platform-codechef",
  code360: "bg-platform-code360",
  hackerrank: "bg-platform-hackerrank",
  interviewbit: "bg-platform-interviewbit",
  gfg: "bg-platform-gfg",
  cses: "bg-platform-cses",
};

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** One line of a weekly board (Coach's .brow). */
export function BoardRow({
  entry,
  isMe,
}: {
  entry: RankedEntry & { isPublic?: boolean };
  isMe: boolean;
}) {
  const platforms = PLATFORM_ORDER.filter((p) => (entry.platforms[p] ?? 0) > 0);
  const split = platforms.length
    ? platforms.map((p) => `${PLATFORM_META[p].name} ${entry.platforms[p]}`).join(", ")
    : "No solves yet";
  const linked = entry.username !== null && entry.isPublic !== false;
  const name = linked ? (
    <Link
      href={`/u/${entry.username}`}
      className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {entry.name}
    </Link>
  ) : (
    entry.name
  );

  return (
    <li
      className={cn(
        "grid grid-cols-[28px_36px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[16px] bg-raised py-2.5 pr-3.5 pl-2 min-[560px]:grid-cols-[34px_40px_minmax(0,1fr)_auto] min-[560px]:gap-3 min-[560px]:pr-[18px] min-[560px]:pl-2.5",
        isMe && "shadow-[inset_0_0_0_2px_var(--primary)]",
      )}
    >
      <span
        aria-label={`Rank ${entry.rank}`}
        className={cn(
          "grid size-7 place-items-center rounded-full font-display text-sm font-bold text-muted-foreground min-[560px]:size-[34px] min-[560px]:text-base",
          entry.rank <= 3 && "bg-primary-soft text-primary-ink",
        )}
      >
        {entry.rank}
      </span>
      <UserAvatar
        name={entry.name}
        image={entry.image}
        shape="squircle"
        size="md"
        tone={isMe ? "primary" : "default"}
        className="size-9 min-[560px]:size-10"
      />
      <span className="grid min-w-0 gap-[3px]">
        <span className="flex flex-wrap items-center gap-2 font-semibold [overflow-wrap:anywhere]">
          {name}
          {isMe && <Chip tone="primary">You</Chip>}
        </span>
        <span className="text-[0.844rem] text-muted-foreground [overflow-wrap:anywhere]">
          {entry.username ? `@${entry.username} · ` : ""}
          active {plural(entry.activeDays, "day", "days")}
        </span>
        <span
          role="img"
          aria-label={split}
          title={split}
          className="mt-[3px] flex h-1.5 max-w-[180px] gap-0.5 overflow-hidden rounded-full bg-muted"
        >
          {platforms.map((p) => (
            <i
              key={p}
              className={cn("block h-full", SEGMENT[p])}
              style={{ width: `${((entry.platforms[p] ?? 0) / entry.solves) * 100}%` }}
            />
          ))}
        </span>
      </span>
      <span className="grid text-right leading-[1.1]">
        <b className="font-display text-2xl font-bold">
          {entry.points.toLocaleString("en-US")}
          <span className="ml-1 font-sans text-[0.78rem] font-semibold text-muted-foreground">
            {entry.points === 1 ? "pt" : "pts"}
          </span>
        </b>
        <small className="text-[0.78rem] text-muted-foreground">
          {plural(entry.solves, "solve", "solves")}
        </small>
      </span>
    </li>
  );
}
