# LogN v2: Interface Plan

> Written 17 Oct 2026. The design source is the finalised claude.ai artifact **CodeLogs Coach 2** (https://claude.ai/artifact/NP8s1JJ6yxysjsuPbJBfVP). Read only that draft; the older ones are superseded. Progress is tracked in §8. Architecture issues from the 21 Oct 2026 audit are listed in §10.

v2 rebuilds the whole interface around Coach 2: a pill-nav app with **Today, Progress, Topics, Sheets, Friends and Contests**, plus a visitor view of `/u/[username]`. The data layer from v1 (adapters, sync, scoring, recommendations, sheets) stays. PLAN.md remains the record of v1 and of every §4 decision, and those decisions still hold.

## 1. Decisions (owner, 17 Oct 2026)
- **Branches:** `v2` was cut from `main` at PR #25 and is the GitHub default branch. `main` stays as v1 and is not changed. Each milestone is a `v2-*` branch with a PR into `v2`. The captain merges a PR into `v2` once CI and review pass. A branch can't be named `v2/…` because `v2` exists.
- **Friends** are in scope: mutual friend requests, a weekly friends board, and an opt-in global board.
- **Leaderboards are difficulty-weighted.** A solve earns points equal to its difficulty band (Band 1 = 1 … Band 5 = 5). An unrated solve earns 1. Boards rank by points, then solves, then active days.
- **Sheets:** follow and unfollow sheets, manual "Solved it" ticks (they count only inside sheets, never in totals, topics or boards), and **Striver's SDE sheet** as a hand-made list of its LeetCode problems. Its non-LeetCode problems are listed but not counted. *Built 18 Oct 2026 as **Striver's 180**:* takeuforward no longer serves the 191-problem SDE day list, and the old SDE sheet URL now redirects to Striver's 180 (179 items in 17 sections), so that is the sheet. `pnpm sheets:striver` reads the list from the page's embedded data (dev-only; robots.txt allows the page) into `lib/sheets/striver-data.ts`, checking every slug against our LeetCode catalog: 144 LeetCode problems are tracked, 33 takeUforward problems (and two LeetCode discuss-post links) are listed only, and two items that share a LeetCode problem count once.
- **Today:** a daily goal (default 3, changeable in Settings, from 1 to 20) counts the UTC day's activity plus the picks marked done that haven't synced yet (owner feedback, 17 Oct 2026). "Mark done" is saved per day in the DB, and a synced solve today ticks its pick on its own.
- **Follow Coach 2 where it differs from v1:** the raw "Platform tags" charts and the v1 topic bar chart are replaced by the topic map. Charts become small server-rendered SVGs, so Recharts is removed. The "Sample data" pill and the draft notes strip are mockup-only and are not built.
- **Kept from v1 even though the draft doesn't show it:** "Sync now" (Connect, and on Progress) and colored difficulty text (M4 owner feedback). The activity period has no "All time": the owner removed it in PR #5, and v2 keeps it out.

## 2. Design system
**Fonts:** Bricolage Grotesque for display (`font-display`: page titles, card titles, big numbers) and Figtree for UI (`font-sans`), both through `next/font/google`. Geist is removed.

**Tokens:** `app/globals.css` maps Coach's palette onto shadcn's tokens, so the generated components restyle without edits, and it adds Coach's extra tokens. Light values are in `:root` and dark values in `.dark` (next-themes class strategy, as before). Components use tokens only, never hex.

| Coach | Token (utility) | Use |
|---|---|---|
| bg | `--background` (`bg-background`) | page |
| surface | `--card` (`bg-card`) | cards |
| surface-2 | `--muted`, `--secondary`, `--accent` (`bg-muted`) | tracks, chips, hover |
| surface-3 | `--raised` (`bg-raised`) | rows and tiles inside a card, popovers |
| fg / fg-muted | `--foreground` / `--muted-foreground` | text |
| grid | `--border` | dividers, chart grid |
| accent | `--primary` (+ `--primary-foreground`) | brand rose: active nav pill, primary buttons, weak |
| accent-soft / accent-ink | `--primary-soft` / `--primary-ink` | rose chips, rose text on soft |
| good / good-soft | `--good` / `--good-soft` | strong, done, verified |
| track / track-soft | `--track` / `--track-soft` | on-track, sheet chips |
| cf / ac / lc | `--platform-*` (kept names) | platform dots, chart series |
| heat-0…4 | `--heat-*` (kept names) | heatmap, week strip |
| cov-1…5 (+fg) | `--cov-*`, `--cov-*-fg` | owner topic map, by coverage |
| pub-1…4 (+fg) | `--pub-*`, `--pub-*-fg` | public topic map, by solves |
| (flame) | `--streak` = the rose | header streak |

**Shape:** cards are `rounded-card` (20px) with `p-6`; large cards are `rounded-card-lg` (24px) with `p-7`. Rows inside cards are `rounded-item` (18px) or `rounded-row` (14px). Buttons, chips and segments are pills. Cards have no borders: surfaces separate by tone. The shadow token `--shadow-pop` is only for popovers and the drawer.

**Buttons:** `components/ui/button.tsx` variants are re-cut to Coach's pill buttons (`default` = rose, `secondary` = surface-2, `ghost`, `outline`, `destructive`; sizes `sm`/`default`/`lg`/`icon`). This is the one hand edit to a generated component, and it is deliberate.

## 3. App shell and routes
**Header** (`components/shell/`): the brand mark, then the pill nav (centered; on phones it drops to its own row and scrolls sideways), then on the right the theme cycle button (system → light → dark), the streak pill (flame and days; rose once today has activity, grey while it waits; links to Progress) and the avatar. The avatar opens the **profile panel**: a welcome line, the Public profile switch, the Global leaderboard switch (disabled until the profile is public), "View my public profile", Connect, Settings and Sign out. Signed out, the header shows the brand, the theme button and "Sign in". On `/u/[username]` a visitor sees the profile URL pill in place of the nav.

| Route | Who | Search params | Built in |
|---|---|---|---|
| `/` | everyone | | V8 (landing restyle; signed-in users get "Open Today") |
| `/today` | owner | | V3 |
| `/progress` | owner | `platform`, `year` | V2 |
| `/topics` | owner | `topic` (opens the drawer) | V4 |
| `/sheets` | owner | `sheet`, `sections=weak` | V5 |
| `/friends` | owner | `board=friends\|global` | V6 |
| `/contests` | owner | | V7 |
| `/u/[username]` | public | | V9 |
| `/connect`, `/settings` | owner | | V8 (restyle; Settings gains the daily goal) |
| `/dashboard` | | | redirects (308) to `/today` in `next.config.ts` |

`proxy.ts` covers every owner route. Filters and toggles are links that change search params (server-rendered, no client state), except the topic drawer, which switches topics on the client and keeps `?topic=` in sync with `history.replaceState`.

## 4. Code structure
```
components/kit/        design primitives, no data access:
  panel.tsx            Panel (md | lg) + PanelHeader (title, info, action)
  page-head.tsx        PageHead (h1 + description)
  chip.tsx             Chip (neutral | primary | good | track | caps)
  bar.tsx              Bar (value 0–1, tone weak|ontrack|strong|neutral, optional expected marker)
  meter.tsx            Meter (name, chip, Bar, sub line)
  ring.tsx             Ring (progress ring with a centered label)
  stat-tile.tsx        StatTile (default | primary)
  segmented-links.tsx  SegmentedLinks (link pills with aria-current)
  disclosure.tsx       Disclosure (<details> with a chevron summary)
  note.tsx             Note (info strip)
  platform-dot.tsx     PlatformDot
  flame.tsx            Flame icon (lit | unlit)
components/shell/      site-header, main-nav (client: active pill), profile-menu + profile-panel, header-streak, theme-toggle
components/charts/     stacked-columns.tsx, heatmap.tsx, rating-line.tsx (SVG, server-renderable)
components/<page>/     today/, progress/, topics/, sheets/, friends/, contests/, profile/
app/<route>/           page.tsx (data + layout only), actions.ts (server actions); user preferences live in app/settings/actions.ts
lib/today/             set.ts, week.ts (pure)
lib/topics/            treemap.ts, view.ts (pure), plus the v1 files
lib/friends/           points.ts, week.ts (pure), queries.ts, actions helpers (server-only)
lib/sheets/            + striver-data.ts, follow.ts (pure); queries.ts gains getSheetState
lib/user-settings.ts   publicProfile, globalBoard, dailyGoal (server-only)
lib/streak.ts          current streak for the header (server-only)
```
Rules: pages fetch and lay out; components receive plain props; anything computable is a pure, tested function in `lib/`. A component is shared through `components/kit` or `components/charts` the moment a second page needs it, never copied. Keep the CLAUDE.md rules (Suspense around session reads, `userId` scoping, `getCurrentUser()` in every action).

## 5. Data model additions (migration `0007_v2`, written in V1)
```
users            + daily_goal smallint not null default 3 (check 1–20)
                 + global_board boolean not null default false
daily_marks      (user_id, day date, platform, external_id, created_at)   pk(user_id, day, platform, external_id)
sheet_follows    (user_id, sheet_id, following bool, updated_at)          pk(user_id, sheet_id)
sheet_ticks      (user_id, slug, created_at)                              pk(user_id, slug)
friendships      (requester_id, addressee_id, status pending|accepted, created_at, accepted_at)
                 pk(requester_id, addressee_id); unique(least, greatest); check requester <> addressee
```
- Every new table cascades from `users.id`, so account delete keeps working, and each one joins the JSON export (V8).
- `sheet_follows` stores explicit choices only. With no row a sheet isn't followed, so new users start with none (owner, 18 Oct 2026; NeetCode 150 was the default before) (`lib/sheets/follow.ts`).
- `sheet_ticks` is keyed by LeetCode slug, so one tick counts in every sheet that has the problem.
- A declined or cancelled request, or a removed friend, deletes the row. The other person isn't told.
- Boards count **verified handles only** (as on public profiles), so a borrowed handle can't climb a board. The week runs Monday 00:00 UTC to now.

## 6. Feature notes per page
- **Today:** the hero shows the local date and greeting (a small client component) and "N problems from your three weakest topics". **Today's set** has up to 5 picks: the first pick of each practice topic, then the weakest topic's second pick, then one "may already be solved" LeetCode pick, with duplicates removed (`lib/today/set.ts`). Each pick shows the platform, difficulty, a sheet chip when a followed sheet contains it, "Trains: Topic · focus", Mark done and Open. To keep the set stable through the day, `getSolveNext` takes `{ keepSolvedSince }` and excludes only solves from before today (UTC); a pick solved today comes back with `solvedToday` and shows as done. The goal ring sits in the card head. The side column has **This week** (7 day columns), **Why these** (coverage meters with an info tip) and **Your sheet** (the first followed sheet, and the next 2 problems in the section that trains your weakest topic).
- **Progress:** the platform filter, stat tiles (total plus one per platform with a status chip, CF rating or the LC E/M/H split), the sync line with Sync now, Active days beside the heatmap (period segments), **Solves per month** (new, last 12 months) and **Difficulty** as stacked SVG columns, and Recent solves.
- **Topics:** a squarified treemap. Tile area is the expected count, color is the coverage step (`cov-1…5`: under 50 %, 50–80, 80–100, 100–120, over 120), and weak tiles get a "Weak" tag. A tile opens a right-hand `<dialog>` drawer with prev/next and Esc. The drawer shows coverage, a state chip, the per-platform split, "solve about N more to leave the weak list", sub-topic bars with an expected marker (focus or lowest chip), practice picks, and the sheet sections that train the topic. Every tile gets at least 6 % of the map so small topics keep a readable name, and under 900 px the map becomes a list of tiles.
- **Sheets:** one card per sheet (progress, note, Follow/Following), then the selected sheet in detail: a ring, "N solved · N left · N sections train your weak topics", segments for All sections and Weak topics, and collapsible sections (each with its topic chip) listing unsolved problems with a "Solved it" tick. Each sheet section maps to a macro topic (`topic` on the section). Striver's off-LeetCode problems are listed in their section as untracked. The honest note about LeetCode's 20 recent solves stays.
- **Friends:** a weekly board (Friends or Global segments; rank, avatar, name, @username, active days, a platform split bar, points with solves under them; your row is outlined; Global shows the top 10, then a gap and your rank when you're listed) and a friends card (add by username, incoming requests with Accept and Decline, sent requests as Pending, your friends list with Remove). An info tip explains the points. `/u/[username]` gets "Add friend" for signed-in visitors.
- **Contests:** one card per platform (CF, LC): a rating line, stats (contests, best rank, current, max, LC global rank and top %), and a collapsed contest history list with rating deltas. The AtCoder note, and the LeetCode badges grid (real icons).
- **Public profile:** an owner banner when you view your own page, the hero (large avatar, name, @username · solving since, social link pills, verified handle chips), tiles (total, then solved per verified platform with solves: CF rating and max, LC contest rating and Easy/Medium/Hard), Active days and the heatmap (last 12 months, no filter), the public topic map (area and green step by solves; no expected or weak values), contest cards, badges, recently solved (6), and a sign-in CTA for signed-out visitors. The OG image moves to the v2 palette and fonts.

## 7. Milestones
Legend as in PLAN.md: 🧭 captain (Opus), 🤖 Sonnet 5.5 subagent with a precise spec, ∥ runs in parallel. Parallel subagents each work in their own git worktree. Subagents don't commit; the captain reviews, runs `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`, commits, opens the PR into `v2`, and merges it once CI is green.

### V0: Setup (`v2-plan`)
- 🧭 `v2` branch as the default, CI on pushes to `v2`, this plan, CLAUDE.md pointers

### V1: Foundation (`v2-foundation`)
- 🧭 Fonts and tokens (`globals.css`, `layout.tsx`), button variants
- 🧭 Schema and migration `0007_v2` (the new user columns are read with `lib/user-settings.ts`, not through Better Auth)
- 🧭 Sheets contract: `topic` on every section, `sheetProgress(sheet, solved, ticked)` with a per-problem `status` (`synced | ticked | null`), `sectionsTraining`, `sheetNamesBySlug`, `lib/sheets/follow.ts`, `getSheetState(userId)` in `lib/sheets/queries.ts`
- 🧭 Routes: stub pages for the new routes, `/dashboard` redirect, `proxy.ts` matcher, `lib/streak.ts`
- 🧭 Dev tools for visual checks: `pnpm dev:preview create` (a throwaway signed-in user cloned from the owner's data; `delete <user>` removes it) and `pnpm dev:shot <url> <png> [--width] [--dark] [--cookie]` (headless Chrome; reports horizontal overflow)
- 🤖∥ `components/kit/*` primitives (§4), ported from Coach 2's CSS
- 🤖∥ `components/shell/*`: header, pill nav, profile panel (with the global-board switch action), header streak, theme cycle
- **Done when:** every route renders inside the new shell in light and dark at 1280 and 360 px, the migration is applied, and the checks pass.

### V2–V7: Pages (all ∥ after V1)
- 🤖 **V2 Progress** (`v2-progress`): `components/charts/{stacked-columns,heatmap}.tsx`, `lib/dashboard/monthly.ts` (tested), `components/progress/*`, `app/progress`
- 🤖 **V3 Today** (`v2-today`): `lib/today/*` (tested), the `getSolveNext` `keepSolvedSince` option, `daily_marks` actions with optimistic Mark done, `components/today/*`, `app/today`
- 🤖 **V4 Topics** (`v2-topics`): `lib/topics/{treemap,view}.ts` (tested), `components/topics/*` (owner map, public map, drawer), `app/topics`
- 🤖 **V5 Sheets** (`v2-sheets`): `lib/sheets/striver-data.ts` (each slug checked against our LC catalog), follow and tick actions, `components/sheets/*`, `app/sheets`
- 🤖 **V6 Friends** (`v2-friends`): `lib/friends/*` (points and week tested), request, accept, decline, cancel and remove actions with limits (20 pending sent), board queries, `components/friends/*` (including `AddFriendButton`), `app/friends`
- 🤖 **V7 Contests** (`v2-contests`): `components/charts/rating-line.tsx`, `components/contests/*` (contest card, badges grid), `app/contests`
- **Done when (each):** the page matches Coach 2 with real data, works at 360 px with no horizontal scroll, has keyboard and screen-reader labels as in the draft, and the checks pass.

### V8: Connect, Settings, landing (`v2-account`) ∥ V9
- 🤖 Restyle `/connect`, `/settings` and `/` with the kit. Settings gets the daily-goal field. The export adds the new tables.

### V9: Public profile (`v2-public`) ∥ V8
- 🤖 `components/profile/*`, `/u/[username]` rebuilt from the V2/V4/V6/V7 components, OG image restyle

### V10: Cleanup and ship (`v2-cleanup`)
- 🧭 Delete v1-only components (`components/dashboard/*` leftovers, tag charts, topic bar chart, `components/ui/chart.tsx`), the `tags` part of the view model and its catalog query if nothing uses it, and Recharts. Update README screenshots, CLAUDE.md layout and this plan.
- 🧭 Full pass in headless Chrome (light/dark, 1280/360, signed out, owner, visitor) against the owner's data
- **Done when:** nothing imports a deleted file, the bundle has no Recharts, and the owner signs off on `v2`.

## 8. Progress
- [x] V0 setup: `v2` is the default branch, the plan is in (PR #26, 17 Oct 2026)
- [x] V1 foundation: tokens, fonts, kit, shell, migration `0007_v2` (applied to Neon), sheets contract, routes, preview and screenshot tools (PR #27)
- [x] V7 Contests (PR #28) · V5 Sheets: follow and manual ticks; Striver blocked, see §1 (PR #29) · V2 Progress (PR #30) · V4 Topics (PR #31) · V6 Friends (PR #32) · V3 Today (PR #33)
- [x] V9 public profile (PR #34) · V8 Connect, Settings (daily goal), landing, export (PR #35)
- [x] V10 cleanup: v1 dashboard components, unused shadcn components, Recharts, the raw platform-tag pipeline (two queries) and `SocialLinksRow` removed; README and CLAUDE.md updated
- Verified per PR: typecheck, lint, prettier, tests (373), CI green, and headless Chrome screenshots against a preview copy of the owner's data at 1280 and 360 px, light and dark
- Known limits: the dev:shot tool can't click, so Mark done, Solved it, Follow, the daily goal save and the friend actions were checked by their agents through headless Chrome scripts or not at all (noted in each PR). The LeetCode contest card's populated state (top %, badge, global rank) wasn't seen with real data, because the owner has no LeetCode contests and the preview clones keep LeetCode unverified on the public page
- [x] Owner feedback after the click-through: Mark done moves the daily goal (optimistic); visited pages stay in the client router for 5 minutes (`staleTimes.dynamic`), and Progress polls while a sync runs; Today loads settings and sheets alongside the dashboard; chart columns show a v1-style hover card; stat tiles keep a quarter-row width when there are few platforms
- [x] Speed and DB cost: user-data reads are server-cached per user and day (`"use cache: remote"`, tag per user, dropped on every write: actions, sync steps, extension); the dashboard's 9 reads go to Neon as one batch; Better Auth's session cookie cache, refreshed in `proxy.ts`; the session read has a lifetime and the pill nav prefetches fully, so every page opens without a skeleton; pages stay in the client router for 30 minutes. Measured on a production build: repeat loads went from about 12 Neon queries to 0, and nav clicks render in 10–30 ms. Contests shows a note instead of an empty card for a platform with no contests
- [x] Owner feedback: public tiles show solved per platform (rating as the sub line, so LeetCode appears without contests); the owner banner names unverified, hidden handles; the extension panel moved from Settings to Connect under the LeetCode card, with `EXTENSION_STORE_URL` (`lib/extension.ts`) for the Chrome Web Store link once it ships
- [x] Google sign-in beside GitHub (owner request, 18 Oct 2026): optional `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, buttons only for configured providers; same verified email links to the same user (Better Auth implicit linking); Google users get a username from their email's local part (`-2`, `-3` on clashes, GitHub logins too); new `users.github_login` (migration `0008`, applied to Neon, backfilled) is what the profile shows as the verified GitHub link
- [x] 👤 Owner: Google OAuth client and a real Google sign-in, in production too (18 Oct 2026)
- [x] Striver's 180 sheet (§1), and sheets start unfollowed for new users (owner, 18 Oct 2026). A section with no LeetCode problem (Mathematics) shows "Not tracked" and isn't offered as training in Topics or Today
- [x] V11 more platforms (§9), built 18 Oct 2026 on `v2-platforms`: contract and migration `0009` (applied to dev Neon), `POST /api/extension/platform` (checked end to end against the dev server: a 170-problem GFG upload connects and verifies the handle, a repeat adds nothing, a different logged-in user gets 409), Connect/Progress/totals for the five, and the extension 0.2.0 (one popup for LeetCode and the five, in the site's palette and fonts, light and dark). HackerRank's count is the distinct solved list when it's complete, since its badge `solved` numbers overlap across domains
- [x] Extension 0.3.0, built 19 Oct 2026 on `v2-extension-connect` (§9 "When it reads", "Connecting"): one-click connect through `/extension/connect` and `POST /api/extension/connect` (checked against the dev server: 403 without the header or cross-site, 401 signed out, a token that works on `/me`, rotation at the cap), a first sync of every platform on connect, automatic sync on visits (6 h) and LeetCode daily, per-platform last-run lines in the popup, and token creation removed from Connect
- [x] Extension 0.3.1, 19 Oct 2026 on `v2-extension-leetcode-access`: LeetCode failed CORS from the service worker unless leetcode.com was open, because Chrome withholds the install-time `leetcode.com` host permission when site access is limited ("On click" etc.) and nothing asked for it again. Connect and Sync now request it like the other five, the LeetCode job stops with a clear "needs permission" message without it, and `/privacy` says LeetCode access can be declined too
- [ ] 👤 Owner: load the unpacked extension 0.3.0, click Connect, and check that the first sync runs and that a visit to a platform syncs it (the extension flow can't be driven from here)
- [ ] 👤 Owner: apply migration `0009` to production Neon, then the PR into `v2` can merge
- [ ] 👤 Owner: load the unpacked extension and Sync each of the five while logged in. The identity reads and the logged-in lists (CodeChef `/recent/user`, HackerRank submissions, InterviewBit `has_solved`, Code360 `view_solved_problems`) were built from research and synthetic fixtures, not a real session. 19 Oct 2026: InterviewBit verified in a real session (9 solves uploaded; `__INTERVIEWBIT__.user.username`, `has_solved`), HackerRank's identity verified (`/rest/contests/master/hackers/me` → `model.username`; the owner's account has no submissions, so the list is untested). A tab opened before logging in reads as logged out, so a `NotLoggedInError` in a reused tab is retried in a fresh one
- [x] Chrome Web Store prep, 19 Oct 2026 on `v2-extension-store`: the extension defaults to and is granted `https://codelogs.techsavy.space` (localhost only as an optional dev host), the optional `https://*/*` is gone (a manifest test rejects wildcard hosts), a public `/privacy` page covers the site and the extension, and `pnpm extension:zip` builds the upload
- [x] Support and feedback (owner request, 19 Oct 2026): a footer on every page with the owner's UPI ID (copy, `upi://` link on phones, QR popover on laptops; PR #40), and on `v2-feedback` a public `/feedback` form linked from the footer. Messages go to a new `feedback` table (migration `0010`, applied to dev Neon) with the IP stored only as an HMAC. Limits: 5 an hour and 15 a day per sender (account or IP), 500 a day overall, plus a honeypot field. Text is cleaned of invisible characters (zero-width, bidi, Unicode tags) before it's stored, and `pnpm feedback` prints it as JSON under an "untrusted content" header (CLAUDE.md rule). Checked end to end in headless Chrome against the dev server: validation errors, honeypot not stored, hidden tag text stripped, the 6th message in an hour refused
- [ ] 👤 Owner: apply migration `0010` to production Neon, then the feedback PR can merge
- [x] Extension 0.3.2, 19 Oct 2026 on `v2-extension-codelogs-access`: the same withheld-access problem as 0.3.1, for LogN itself. With limited site access Chrome also withholds `codelogs.techsavy.space`, and the API sends no CORS headers, so Connect never finished (the connect tab's URL is hidden) and every upload failed. Connect and Sync now ask for the LogN origin too, Connect stops with a message without it, and a job without it says so. The upload routes' 401 no longer points at Settings (tokens come from Connect since 0.3.0)
- [x] Extension 0.3.3, 19 Oct 2026 on `v2-extension-store-listing`: the store rejected 0.3.2 for "excessive keywords" (violation "Yellow Argon"), quoting the list of six platform names in the manifest `description` (the listing's summary line). The summary no longer lists them; the store description names them once, in a sentence
- [x] 👤 Owner: submit the extension to the Chrome Web Store (live 20 Oct 2026 at `https://chromewebstore.google.com/detail/codelogs/cnhphpfejpffijadknkhiaifgmpgmmch`); on `v2-extension-store-link` `EXTENSION_STORE_URL` points there, so Connect shows the store link and an "Add to Chrome" button instead of the load-unpacked steps, and both READMEs link it
- [x] Username change in Settings (owner request, 21 Oct 2026, `v2-username-change`): pick your own username once (`users.username_changed_at`, migration `0011`, applied to dev Neon). Same rules as before (2–39 of `a-z 0-9 . _ -`, lowercase), plus a letter or number at both ends and a few reserved names (`lib/username-change.ts`); another user's username or GitHub login counts as taken. A live check while typing, then a confirm step. The save is one guarded update batched with the friend lookup; the unique index settles races. It refreshes the session cookie cache and drops friends' cached lists (their buttons act by username). The header and delete confirmation read the DB's username, so other devices don't lag the 5-minute cookie cache. Friend lookups match usernames exactly (unique index) instead of `lower()`, and `0011` lowercases any older mixed-case username. Old `/u/<old>` links stop working (no redirects). Review fixes: friend buttons (Accept, Decline, Cancel, Remove, profile Add friend) act by user id, since a page can outlive a username; sign-up's `claimUsername` skips reserved names and other users' GitHub logins too; picking a first username (none at sign-up) doesn't use the change. Checked end to end in headless Chrome against a production build
- [ ] 👤 Owner: apply migration `0011` to production Neon, then the username PR can merge
- [x] Extension-platform topics (owner request, 22 Oct 2026, `v2-ext-topics`): InterviewBit on the topic map against LeetCode's catalog (§9 Topics). The no-map note names the connected platforms and why (no tags, InterviewBit solves with no mapped topic, LeetCode counts not synced) instead of always blaming AtCoder. Extension 0.3.5: GFG problem links end in `/1` (the bare slug is a 404). That fixed only new problems: a user sync inserts problem rows with `ON CONFLICT DO NOTHING`, so a stored URL never changes (see `v2-gfg-links`)
- [x] ~~👤 Owner: upload extension 0.3.5 to the Chrome Web Store~~ superseded by 0.4.0 (rename)
- [x] GFG links without the extension update (22 Oct 2026, `v2-gfg-links`): the platform upload stores GFG problem links under `/1` whatever the extension sent (`problemUrl` in `lib/extension-upload.ts`), so store version 0.3.4 stops storing 404 links for new problems; data migration `0012` rewrites the stored ones, which no sync would (applied to dev Neon: 252 rows)
- [ ] 👤 Owner: apply migration `0012` to production Neon, then the GFG links PR can merge
- [x] Extension verification for Codeforces, AtCoder and LeetCode (owner request, 22 Oct 2026, `v2-ext-verify`, §9 "Login-match verification"): `POST /api/extension/verify`, LeetCode uploads verify on a username match, a hint under the Connect page's Verify panel, `/privacy` updated, extension 0.4.0 (Codeforces and AtCoder rows with Verify, optional host access to both)
- [x] Rename to **LogN** (owner decision, 22 Oct 2026, `v2-rename-logn`): before launch, so everywhere. UI, docs and the header wordmark "Logん"; site `https://logn.techsavy.space`; repo `savinyu/LogN`; verification codes `logn-…`; extension connect marker, event and `X-LogN-Extension` header; Inngest app id `logn`; export tag `logn-export` and `logn-<user>-<date>.json`; User-Agent `LogN/0.1` (LeetCode answers 200, checked 22 Oct 2026); `logn` reserved as a username (`codelogs` stays reserved). Extension 0.4.0 (connect protocol changed, so the site and the extension ship together); on update it moves a saved `codelogs.techsavy.space` URL to the new origin and keeps the token.
- [ ] 👤 Owner, before merging the rename: add `logn.techsavy.space` in Vercel (DNS CNAME), keep `codelogs.techsavy.space` as a redirect to it, set `BETTER_AUTH_URL=https://logn.techsavy.space` in Vercel, and add `https://logn.techsavy.space/api/auth/callback/github` (and `/google`) to the OAuth apps
- [ ] 👤 Owner, after merging: re-sync the Inngest app (new id `logn`) and archive the old `codelogs` app; upload extension 0.4.0 to the Chrome Web Store (the new host permission makes Chrome ask existing installs to approve it) and rename the listing; retake `docs/screenshots/banner.png` and `extension.png`
- [x] The extension connects Codeforces, AtCoder and LeetCode too (owner request, 22 Oct 2026, `v2-ext-connect-synced`, §9 "The extension connects the synced three too"): `/api/extension/verify` and the LeetCode upload connect the logged-in user when no handle is connected, verified, and queue the first server sync; extension 0.4.1 (Connect on an unconnected Codeforces or AtCoder row)
- [x] Removing a platform sticks (owner request, 22 Oct 2026, `v2-ext-remove-platform`, §9 "Removing a platform"): table `platform_opt_outs` (migration `0013`), Remove on Connect records it and typing a handle clears it, the extension's three write routes take `manual` and refuse to connect a removed platform without it, `/api/extension/me` lists `removed`, a Connect-page hint on removed platforms; extension 0.4.2 (automatic runs skip a removed platform before opening a tab, the popup shows "Removed"). Review fixes: an automatic connect checks the removal inside its `INSERT … WHERE NOT EXISTS`, so a Remove that commits mid-upload wins; a skipped run doesn't count as a sync, so a handle added back on Connect syncs on the next visit
- [ ] 👤 Owner: apply migration `0013_platform_opt_outs` to the prod Neon DB before `v2-ext-remove-platform` merges
- [ ] 👤 Owner: load the unpacked extension 0.4.2 logged in to Codeforces and AtCoder and click Verify (or Connect) on each (the logged-in Codeforces header and AtCoder `userScreenName` couldn't be seen from here), then upload it to the Chrome Web Store
- [ ] 👤 Owner: click through `v2` (Today's Mark done, Sheets ticks and follows, Friends with a second account, Settings daily goal), then decide when `v2` replaces `main`
- [x] Repo audit, 21 Oct 2026: six read-only audits (sync, auth and API, dashboard and topics, friends and sheets, UI, extension), each finding checked by the captain, then fixes in six PRs into `v2`, none with a migration: #61 upload day validation, export completeness, username fallback · #62 Codeforces cursor past a pending verdict, earliest solve date, AtCoder 404 · #63 header streak cap, leap-year heatmap label, "solve N more" count · #64 Mark done day, friend-request states, action error handling, account delete · #65 topic drawer link, action crash handling, sign-out, progress filter, charts · #66 extension 0.3.4. Design-level findings are in §10, not started
- [ ] 👤 Owner: review and merge #61–#66 (each was checked with typecheck, lint, prettier and tests, but not clicked through in a browser), then submit extension 0.3.4 to the Chrome Web Store

## 9. More platforms: CodeChef, Code360, HackerRank, InterviewBit, GFG (V11, from 18 Oct 2026)
### Decisions (owner, 18 Oct 2026)
- **These five are the targets.** Platforms with open public APIs (DMOJ, Codewars, yukicoder, …; `scripts/spike/platforms/public-api-platforms.md`) are out of scope.
- **Extension only.** The server never fetches these five, and there is no server "counts" layer for them. This replaces PLAN.md §4 "More platforms" for them. Why (`scripts/spike/platforms/codolio-platforms.md`): CodeChef's terms ban spidering and scraping; GFG's ban bots and scripts; InterviewBit's ban spiders and its robots.txt disallows `/profile`; HackerRank's robots.txt disallows `/rest/` and `/profile/`; Code360's terms couldn't be read.
- **Other routes considered and dropped:** server fetches of the public JSON (above); CodeChef's official API (the developer portal is gone, and access is by email to api@codechef.com only; the owner may ask, not planned); manual count entry on Connect (owner: no); third-party aggregators (they scrape, so the same problem); a bookmarklet (the extension with worse UX).
- **Verification is a login match.** A handle on these platforms becomes verified when the extension uploads while the browser is logged in to that platform as that handle. There's no bio code. The first upload also connects the handle if the user hasn't added it on Connect. Someone hand-crafting requests with their own LogN token could forge it; accepted.
- **Login-match verification for the synced three too (owner, 22 Oct 2026):** the bio code stays for users without the extension, and the extension adds a one-click path. LeetCode: an extension upload whose `user_name` matches the connected handle verifies it (a JSON import doesn't). Codeforces and AtCoder: the server still syncs them from public APIs, and the extension only reads who the browser is logged in as (CF's header profile link inside a codeforces.com tab, since a service-worker fetch meets Cloudflare's challenge; AtCoder's `userScreenName` page global) and posts it to `POST /api/extension/verify` (`lib/extension-verify-shared.ts`). It never syncs solves for them. It runs after connecting, on Verify in the popup, and on visits to those sites (6 h, that tab only) while the handle is unverified. Same forgery caveat as above.
- **The extension connects the synced three too (owner, 22 Oct 2026):** both ways work. A handle typed on Connect is checked as before (bio code, or the extension's login match). With no handle connected yet, the extension connects the user the browser is logged in as, verified: on Codeforces and AtCoder through `POST /api/extension/verify` (popup button "Connect"), on LeetCode through its upload. The server first confirms the handle with the platform's API (`connectLoggedInHandle` in `lib/accounts.ts`, which also gives its casing), then queues the first server sync. A connected handle that differs from the logged-in user is never replaced: the user removes it on Connect first. A JSON import still needs the handle connected.
- **Removing a platform (owner, 22 Oct 2026; replaces "a removed handle comes back on the next visit"):** Remove on Connect deletes the handle and its solves and records the platform in `platform_opt_outs`, in one `db.batch`. The extension's automatic runs (after connecting, on visits, LeetCode's daily alarm) don't connect a removed platform again: `/api/extension/me` lists `removed`, and the extension skips it before opening any tab. Only an explicit action brings it back: typing a handle on Connect, or clicking the platform's Sync or Connect in the popup, which sends `manual: true` on `/api/extension/{verify,leetcode,platform}` and clears the row. The server enforces it too: without `manual: true` (older extensions don't send it) a removed platform is refused with 409 and a message pointing to Connect.
- **How the extension reads:** inside a tab of the platform's own site (an open one, or a background tab it opens and closes), using the same requests that site's frontend makes, with the user's own session. One request at a time, at least 1.5 s apart, with back-off on 429/403. It sends LogN only handles, problem ids, titles, URLs, difficulty labels, dates and counts: never cookies, passwords or code. Host access for each platform is an optional permission, asked in one prompt when the user clicks Connect (or on that platform's first Sync if declined).
- **When it reads (owner, 19 Oct 2026; replaces "only when the user clicks Sync"):** once for every platform right after connecting (background tabs allowed, since the user just clicked), then automatically: on a page load on the platform when its last sync is older than 6 hours, in that same tab only (never a tab of its own), and LeetCode daily from an hourly alarm. A switch in the popup turns automatic sync off; Sync stays for "now". Why the visit trigger: it looks like the user's own browsing, which keeps it clear of the "no bots" terms (GFG, CodeChef), and Chrome Web Store policy needs disclosed consent, which the Connect screen gives.
- **Connecting (owner, 19 Oct 2026):** no token to copy. The popup's Connect opens `/extension/connect`. Once the page shows a signed-in user, the extension runs a script in that tab that calls `POST /api/extension/connect` same-origin with the session (custom header and Origin check against CSRF), and stores the returned "Browser extension" token. At the 5-token cap the least recently used "Browser extension" token is replaced. Connect lists tokens as "Connected browsers" with Revoke; manual token creation is gone.

### What each platform gives
Public data was verified on 18 Oct 2026; the logged-in endpoints are in `scripts/spike/platforms/logged-in-endpoints.md`, and they need the owner's logged-in browser to confirm.

| Platform | Count | Solved list | Dates | Difficulty | Calendar |
|---|---|---|---|---|---|
| GFG | `total_problems_solved` | yes (`problems/submissions/` POST) | yes | School/Basic/Easy/Medium/Hard | – |
| CodeChef | profile page "Total Problems Solved" | names only publicly; logged-in list to confirm | no | – | to confirm |
| HackerRank | badges' `solved`, summed | recent challenges only; logged-in list to confirm | partly | – | daily submissions |
| InterviewBit | `total_problems_solved` | no | no | very_easy/easy/medium/hard | daily submissions |
| Code360 | `total_count` | logged in only (`view_solved_problems`) | no | Easy/Moderate/Hard/Ninja | to confirm |

### How the data counts
- **Totals and tiles** use the platform's own count (`platform_stats` kind `ext_counts`: total, the counts by label, and an Easy/Medium/Hard split), shown as "reported" like LeetCode's.
- **Solve rows** come from the solved list where there is one (GFG now; others once the logged-in lists are confirmed), as stub `problems` rows with the platform's difficulty label banded by `lib/sync/difficulty.ts`. They feed Recent solves, Difficulty and Solves per month.
- **Activity** comes from the platform's daily submission counts where it has them (HackerRank, InterviewBit), otherwise from the solve dates.
- **A real zero** (the platform answered, nothing solved) is a successful sync that verifies the handle (owner, 19 Oct 2026). Progress hides a platform tile that is a confirmed zero (synced, 0 solved) but keeps pending or failing ones for their status chip; the public profile and OG image list only platforms with solves.
- **Boards** count dated solves of verified handles, as for every platform, so a counts-only platform adds no weekly points.
- **Topics (owner, 22 Oct 2026):** InterviewBit's solves feed the topic map through their tags (`lib/topics/mappings/interviewbit.ts`). The server can't read InterviewBit's catalog, so its expectations borrow LeetCode's free catalog shares (both interview-style); both sides count only problems with a mapped topic, so "Time Complexity" quizzes and array-only problems don't count. No picks come from InterviewBit. GFG tags (one extra request per problem) and the other three (do their logged-in lists carry tags?) are undecided.
- **Not yet:** recommendations from these platforms, contests (CodeChef's rating history is on its profile page), and GFG problems in Striver's sheet.

### Code
- `lib/db/schema.ts`: `SYNCED_PLATFORMS` (CF, AtCoder, LC) and `EXTENSION_PLATFORMS` (the five), `PLATFORMS` = both; migration `0009_extension_platforms` appends the enum values. Types `SyncedPlatformId` / `ExtensionPlatformId`; `isSyncedPlatform()` in `lib/platforms.ts`. Adapters, sync claims, the stale-account cron, bio verification and "Sync now" are synced-only.
- `lib/extension-upload.ts`: the upload contract (`extensionUploadSchema`), `ext_counts`, `difficultySplit`, allowed problem hosts.
- `POST /api/extension/platform` (Bearer token) → `lib/extension-platform-ingest.ts`; `GET /api/extension/me` lists every connected handle.
- `extension/`: one extension for LeetCode and the five, styled with the site's tokens and fonts, one reader per platform in `extension/lib/platforms/` (a self-contained fetch run in the platform's tab, plus a pure parser tested against fixtures).

### V11 tasks (`v2-platforms`)
- 🧭 Contract: enum and migration `0009` (applied to dev Neon), the synced/extension split, metadata, difficulty bands, colour tokens, upload contract
- 🤖∥ Research: logged-in identity and solved-list endpoints for the five (from open-source extensions)
- 🤖∥ Server ingest: `lib/extension-platform-ingest.ts`, the route, `me` with every handle, tests
- 🤖∥ App: Connect cards for extension platforms (no Sync now or bio code; "Sync with the extension"), totals and tiles from `ext_counts`, every platform list and colour in Progress, Friends, the public profile and the OG image
- 🤖 Extension: the restructure, the site theme, five readers with fixture tests, the popup listing each platform with its handle and a Sync button
- 👤 Owner: log in to each platform and run Sync in the extension; the logged-in requests couldn't be tested without an account
- 👤 Owner: apply migration `0009` to the production Neon database before the PR merges
- **Done when:** an upload for each platform lands in the dashboard (totals, tiles, recent solves where there is a list), the extension matches the site in light and dark, and the checks pass.

## 10. Audit findings: architecture (21 Oct 2026, not started)
A full-repo audit on 21 Oct 2026 found bugs and design problems. The bugs with a contained fix went to PRs (§8). The items below need a design change or an owner decision, so they are listed here and **not started**. Ordered by priority within each group. 👤 marks a choice the owner has to make first.

### Sync and rate limits
- [ ] **Platform politeness isn't held across accounts (high).** Inngest's `concurrency` limits concurrent *steps*, not runs, and a run sleeping between pages (`step.sleep`) frees its slot. So while account A waits its 2 s, account B's (or the catalog's) steps run, and requests to one platform can go out back to back. `minDelayMs` only holds between pages of one account; `http.ts`'s `pace()` is per process. Direction: a shared per-platform pacer, e.g. a `platform_pace(platform, next_at)` row claimed with one atomic `UPDATE … SET next_at = greatest(next_at, now()) + delay RETURNING` before each request step, followed by `step.sleepUntil`; or one long-lived run per platform that drains a queue.
- [ ] **Stuck-sync recovery races the queue (medium).** `SYNC_STALE_MS` (30 min, `lib/sync/runs.ts`) is measured from the claim. After the 04:00 cron claims every stale account, they queue behind one slot per platform; with a few hundred accounts the tail waits more than 30 min, counts as stuck, and "Sync now" claims it again, so duplicate runs go out. Direction: measure staleness from `startAccountSync` (a `started_at`), or keep the event id and treat a queued run as alive.
- [ ] **Stale-account claim and send aren't atomic (low).** `sync-stale-accounts` claims in one step and sends events in another. A lost step response or a failed send leaves accounts in `syncing` until the stuck rule fires. Direction: send inside the claim step, or release the claims on failure.
- [ ] **Catalog sync is one step (low).** `sync-catalog` fetches a whole catalog (LeetCode: ~41 sequential requests, ~60 s) in one `step.run`. A host timeout or a failure on the last page throws all of it away and retries from the start. Direction: page it across steps like the account sync.
- [ ] **High-water-mark cursors (low).** The Codeforces id and AtCoder second cursors assume nothing older shows up later (the pending-verdict case is fixed in the audit PR; late crawls by kenkoooo are possible). Direction: re-scan a small overlap window behind the cursor; inserts are idempotent.
- [ ] **Live handle checks aren't throttled (low).** `connectPlatform` and `checkVerification` call the platform on every action with no per-user cooldown and outside the pacer. A scripted client could get the app's IP banned. Direction: a per-user cooldown and the shared pacer above.

### Trust and shared data
- [ ] 👤 **One verified handle, one user (medium).** Nothing stops two users from holding the same handle verified. For the extension platforms "verified" is a login match the client asserts (§9 accepts the forgery), so anyone with a token can claim a famous handle, show its verified link and add dated solves to the boards. Direction: a partial unique index on verified `(platform, lower(handle))` (needs a decision on the existing duplicates and on who wins), and possibly no board points from extension platforms.
- [ ] **Users write the shared `problems` table (medium).** Extension and LeetCode uploads insert stub problems with `onConflictDoNothing`, so the first uploader's title, URL and difficulty become everyone's, and nothing corrects them for the five extension platforms (no catalog). Each upload can also add up to 10,000 junk stubs (5,000 LeetCode slugs) with no cleanup. Direction: keep user-supplied metadata apart from the catalog (or only fill null columns), cap new stubs per upload, and garbage-collect stubs no solve points to.
- [ ] **Extension uploads aren't atomic (low).** `ingestExtensionUpload` writes problems, solves, stats, activity and the account status as separate neon-http statements, so a failure midway leaves partial data and an old status. Direction: one `db.batch`, or status "syncing" first and the result last.
- [ ] 👤 **"Remove" on Connect doesn't stick for extension platforms (medium).** §9 says the first upload connects a handle that isn't on Connect, so after the user removes, say, GFG, the extension's next visit sync recreates the account (verified) and re-imports everything. Only revoking the token stops it. Direction: a per-platform tombstone that only the extension's explicit Connect clears, or the extension skipping platforms missing from `/api/extension/me` outside Connect. Also: the extension's Disconnect only forgets the token locally, so old tokens pile up toward the 5-token cap; add a revoke endpoint and call it.
- [ ] **Tokens never expire (low).** Direction: an idle expiry (e.g. 90 days since `lastUsedAt`) in `authenticateBearer`.
- [ ] **Count-then-insert limits (low).** The 20 pending friend requests and the 5-token cap are checked and inserted in separate statements (no transactions on neon-http), so parallel calls overshoot. Direction: one `INSERT … SELECT … WHERE (SELECT count(*) …) < n`.
- [ ] **Friend-request abuse (low).** Decline deletes the row, so the sender can ask again at once; there's no cap on incoming requests and no block; username lookup also tells anyone which usernames exist, private profiles included. Direction: a cooldown or `declined` state, an incoming cap, and maybe a block list.

### What counts as activity
- [ ] 👤 **The daily goal counts LeetCode submissions, not solves (medium).** LeetCode's activity comes from its `submissionCalendar`, which counts every submission (FINDINGS.md: 611 submissions for 319 solved). `buildActivity` uses a platform's calendar instead of its solve days, so three failed LeetCode submissions meet a goal of 3, and the same numbers feed This week and the heatmap. §1 says the goal counts "the day's activity", so this is a semantics choice. Direction: count distinct problems solved today (plus marks) for the goal, and keep submissions only for the heatmap with the label saying so.
- [ ] **Two definitions of an active day (low).** `lib/streak.ts` unions every platform's solve days with calendar days; `buildActivity` drops a platform's solve days once it has a calendar. The header streak and the Progress streak can disagree. Direction: one shared function (or SQL view) for active days.
- [ ] **The UTC day and the 30-minute client cache (low).** Pages stay in the client router for 30 minutes (`staleTimes.dynamic`), so Today can show yesterday's set for up to 30 minutes after UTC midnight (05:30 in India), and writes from the extension or Inngest don't reach pages already in the client cache. The greeting uses local time while everything else is UTC. Direction: a shorter lifetime for Today around the day boundary, or a client check that refreshes when the UTC day changes; say "UTC" where days are shown.
- [ ] 👤 **Recommendations ignore sheet ticks (low).** A LeetCode problem ticked "Solved it" on a sheet can still be picked on Today and Topics. §1 says ticks count only inside sheets, so this needs a decision.

### Scale and front end
- [ ] **Global board scaling (low today).** `getGlobalBoard` is cached per viewer although its top 10 is the same for everyone, reads every listed user with a large `IN (…)` list, and calls `cacheTag` per listed user. Direction: one viewer-independent cached board (top N in SQL with `ORDER BY … LIMIT`) and a separate lookup of the viewer's rank; later, a weekly-points rollup written at sync time.
- [ ] **Action error contract (low).** Actions return free-text errors that clients sometimes parse (`includes("is still pending")`; the friends one gets a `code` in the audit PR). Direction: a small `safeAction` wrapper that always returns `{ ok: false, error, code? }`, so no call site needs its own try/catch.
- [ ] **Topics drawer URL state is write-only (low).** `TopicsExplorer` writes `?topic=` with `replaceState` but never reads it back, so Back/forward and `router.refresh` can desync the drawer from the URL. Direction: derive the selection from the URL or listen to `popstate`.
- [ ] **Sync status by polling the page (low).** Progress and Connect re-render the whole RSC page every 3 s while a sync runs. Direction: a small status endpoint (or SSE) and a refresh only when it changes.
- [ ] **Charts are pointer-only (low).** The rating line, month columns and difficulty ring have no keyboard affordance (screen readers get sr-only lists). Direction: one shared chart-tooltip primitive with focusable points.
- [ ] **Extension service-worker lifecycle (low).** The job lock is in memory, background tabs aren't recorded, waits use `setTimeout` and fetches have no timeouts, so a worker killed mid-job leaks a tab and leaves the popup showing "running" until its staleness check. Constants (problem hosts, slug pattern, upload types) are copied by hand between `extension/` and the server, guarded only by tests. Direction: a lock and tab list in `chrome.storage.session` cleaned up on start, `AbortSignal` timeouts, and one generated source for the shared constants.
