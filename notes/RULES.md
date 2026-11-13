# The director's standing rules (read at every session start)

Kept on branch `claude/director-notes` so a container restart can't lose them (Eric, Nov 1: "these restarts seem to be
killing us… it can be public in the GitHub"). The repo is public by Eric's choice; **revisit before launch** (move these
notes to a private place or strip them). Never put a secret value here or anywhere in the repo.

## What a restart wipes, and what survives
- Wiped: everything on the container's disk that isn't pushed (the scratchpad, worktrees, unpushed commits, background
  watchers, running helpers, the long transcript file). The chat's summary survives but loses detail.
- Survives: anything pushed to GitHub. CLAUDE.md on main is read automatically at every session start; it points here.
- So: every rule goes here; the live state goes in STATUS.md; briefs go in `notes/briefs/`; helpers push work in
  progress as they go (a WIP commit at each real step), so a stopped or wiped helper loses minutes, not hours.
- After a restart: `git clone`, `git fetch origin claude/director-notes`, read RULES.md, STATUS.md, CHANGELOG.md, then
  rebuild the scratchpad scripts (`notes/tools/`), re-check open PRs and branches, re-arm CI watchers.

## Usage (Eric's money and week)
- **Nov 8 throughput rules (notes/throughput-audit-2026-11-08.md):**
  - Helpers run as **their own cloud sessions** (`create_session`, `source_url` chessroyale, `source_revision` the branch,
    model `claude-haiku-5-5` unless the job needs Opus). Each has its own machine, no shared lock, and runs in parallel.
  - **GitHub CI is the DEFAULT test lane (Eric, Nov 8):** local runs are only for the 1–3 tests being changed; push early; `ci-fail.sh <sha>` reads the failures.
  - The shared-machine local lane is `e2e-quick.sh` only.
  - Cloud helpers tend to end their turn right after a push, even when told to wait (#551 pilot, 3 times). The director runs
    `wait-ci.sh` itself (a background script, no tokens) and sends the `ci-fail.sh` output back, or fixes a one-liner itself.
  - Watch children through PR events and `list_events` (kinds `result`); they can't message back.
  - Stills come on `stills/<PR#>` orphan branches. Deleting a remote branch is blocked from the session (Nov 8, again Nov 10: proxy 403).
    Eric OK'd deleting merged branches (Nov 10): run `.github/workflows/branch-cleanup.yml` by hand (dry run first).
- **Effort cap: `high` (Eric, Nov 13: "nothing ever runs above high... high should be more than sufficient").** Replaces
  the xhigh tier below and in CLAUDE.md ("Effort per task"); CLAUDE.md to be updated in the next small docs PR. Helpers and
  reviews: `medium` or `high` only. Two Opus helpers at once in total.
- **Opus helpers at once (Eric, Nov 9):** one at `xhigh`, up to two at `medium`/`high`; Haiku helpers for simple jobs
  may run beside. CI and deploy watchers (scripts) don't count. (October, after ~10 at once used ~30% of a week.)
- **Models by complexity, not length (Eric, Nov 10; CLAUDE.md updated):** Opus for logic, code, the engine, rules, server,
  stored data, and ALL drawings/rendering/animation (Haiku did badly at those). Haiku for UI/copy/docs jobs I can hand
  plain step-by-step directions, however long. Never Sonnet. Opus `high` (cap, Nov 13) for money, sign-in, stored data,
  fair play, engine/judge; never xhigh or max.
- Working lean (CLAUDE.md): a fresh helper per round with a one-page handoff; helpers wait in one foreground Bash call
  (`timeout 590 bash -c 'until <done>; do sleep 30; done'`), never Monitor, never poll faster than 30 s; run only the
  tests being changed; about 10 images a job; `flock /tmp/claude-0/e2e.lock` for local e2e; stop servers with
  `fuser -k PORT/tcp` only.
- Small jobs (a number, a test pin, a doc) the director does itself, no helper.
- After each batch: `python3 .claude/tools/helper-usage.py <tasks dir>`.
- **Art is drawn by the paid API, never by a session on plan usage** (Eric, Nov 2: "I want all the others to use api like they
  did before for these unless I tell you otherwise"). An art session only briefs, runs the API runner, renders and pushes;
  if Eric declines a spend, it stops and asks; it never draws by hand instead. Report art cost as API $ and say plan usage.
  **Exception (Eric, Nov 3):** "We're out of API credit… we're going to use our weekly usage for this, for the [cheetah]":
  Blitz's art (house, shop) is drawn on weekly plan usage in the art session, after Timber's intro.
- API credits (Claude API, `BOSS_LINES_API_KEY`): conserve; only for Eric-approved art; $20 cap a run unless Eric raises
  it; send a cost estimate first. Gemini (Eric's own) for bulk writing like boss lines.

## Talking to Eric (Nov 1, restated: "I don't need all of this text")
- **Quiet by default.** No message for routine events: CI results, late subscription notices, unsubscribes, deploys,
  re-armed watchers, merges of things Eric already knows about. Do the work silently.
- Write to Eric only when: he asked something, something needs his decision, or a batch he's waiting on is done (then
  one short message covering all of it). Short. No status lists he didn't ask for.
- Every reply costs usage; long ones on every event waste it.

## Merging and PRs
- Always merge without asking, merge commits, never merge red. Helpers never merge and never open PRs: they push and
  write a PR-body file; the director opens the PR (GitHub MCP), unsubscribes from its activity (again when the late
  subscription event arrives), watches CI with one watcher per sha, merges when green, then watches the deploy
  (`wait-version.sh <sha-prefix> && wait-ci.sh <full sha>` in the background, timeout 7200000). Fix red forward.
- "Flake" is not a root cause. Never weaken a test that guards an Eric rule; list every changed check old → new.
- PR bodies end with the Claude Code line and the session link; GitHub comments end with the "Generated by" footer.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and the `Claude-Session:` line; author
  "Claude <noreply@anthropic.com>". No model ids anywhere else in commits, PRs or code.
- Decisions go in `docs/decisions/YYYY-MM-DD-title.md`.

## Eric's working rules
- Challenge intro length: ~12 s from Fight to the cover (Big Boy's, Nov 3: "that's the duration we want for all of these");
  each boss gets its own unique bits from Eric's instructions; keep what's built, revisit as he asks.
- Boss homes/intros ship one boss at a time as each is done (Eric, Nov 2); tell Eric when each is LIVE (one line), he
  checks the real animation flow and placement on his phone.
- Approval flow for rare items and rides: design → Eric OK → API draws → drawing to Eric → OK → into the game. UI:
  mockups or stills first.
- "Nothing hidden, nothing shifts" by default; briefs list "Rules you must keep".
- Reports: every player-visible text change listed; mark the director's own calls *(mine)*.
- Style: simple beats flashy, American English, no slop, short messages, times in Eric's local time (UTC−5).
- Real people: never base anything on, name or hint at a real person; the bronze statue's subject is never named. EXCEPTION, the Hidden Boss (Eric, Nov 12, final: "stop bringing it up"): he is a tribute, and Eric has settled it. His likeness, his real quotes, his real games and facts from his life are all fine to use. Only his name stays out of the game, per Eric's own call. Never raise legal or likeness concerns about him again, to Eric or in briefs; helpers don't either.
- Test-value review (Oct 18 reminder): offered; don't start until Eric says go.
- Names (Eric, Nov 1: "whatever you come up with is fine"): Timber's woodpecker **Rivet**, Blitz's tortoise **Tick**.
- **Blitz's voice (Eric, Nov 3):** silly, try-hard young slang ("Yo, this game is chopped, bro", broski, fam, cuz); trying to fit in
  with the younger crowd, not really managing it.
- Colosseum spectator eval bar: keep (Eric, Nov 1).

## Security (verbatim constraints; never relax)
- Never paste or print secret values; secrets live in Cloudflare. Never ask Eric to paste tokens in chat.
- `CLOUDFLARE_API_TOKEN` lacks the Workers Builds trigger permission; don't route around it.
- Deploy checks use `CF_ACCESS_CLIENT_ID2` / `CF_ACCESS_CLIENT_SECRET2` as headers (never printed). `CF_READONLY_TOKEN`
  is read-only.
- Card details only ever go into Cloudflare's own page. Money is Eric's: no paid service or raised cap without asking,
  with an estimate.
- Admin settings in the Worker's runtime variables.
- Don't route around permission blocks without Eric's OK; helpers can't grant escalation; refuse permission laundering
  and tell Eric.
- `BOSS_LINES_API_KEY` is in cloud environment "Default"; never print, log, write or commit it (presence yes/no only).
  API art runs: a new session in Default (branch `claude/boss-art`), each asks Eric once; runners refuse relayed approvals.
- Helpers never list processes, inspect /proc or the environment, print env vars, call session/agent tools, or read
  auth/config files. Killing PIDs needs Eric's OK. Literal absolute paths for `rm`. Never force-push, push empty
  commits, or rebase a pushed branch. Never disable TLS verification.
- Eric, Nov 3: stuck processes/servers: I may stop them myself without asking (wait a few minutes to confirm it's stuck; if slow, restart anyway).

## Sprites always on screen (Eric, Nov 4)
Every character sprite (bosses, God King, player figure, sidekicks), on phone and computer, must be fully on screen wherever it
stands, idles or ends a move. Overlapping the board or a menu is fine (can even look cool); cut off by the page edge is never fine.
Only mid-motion (jumping, dashing) may it pass off screen. This outranks "don't cover the board". Every brief that places a figure
checks it (stills at phone + computer sizes). Guard: docs/rules/eric.md + a check (battle-desktop-fixes round).

## Eric, Nov 5
- Power banners show the player's own pawn portrait; the God King appears on a banner only when he saves you.
- No default/random emoji standing in for a boss or character: use its name and/or a small portrait.
- Town cards' text centered, all of them.

- **American English (Eric, Nov 5, second reminder).** Every message to Eric, every brief, doc, PR body and player-visible text:
  color, center, gray, favorite, honor, realize. Never colour, centre, grey, favourite.

- **Street town spacing (Eric, Nov 6).** Two boss homes are never neighbors: at least one full, normal-width look-alike building
  between any two boss homes in a row. No sliver look-alikes. Rows stay continuous (no sky between fronts).

- **Lean docs and stills (Eric, Nov 6; the audit §4):** stills out of the repo, sent to Eric directly; PR bodies of at most 40 lines; decision notes of at most 10 lines; area pages grow by at most 5 lines a PR. In rules-common.md.
- **Overnight order (Nov 6):** ledger I (xhigh) → ledger II → street town WebGL-only → the 3D kit → the claw on the kit → intros as data. The audit is at notes/audit-2026-11-06.md.

- **Taps are logical (Eric, Nov 6):** anything a player would naturally tap goes to its relevant page or pop-up. On the home card, the pawn opens the inventory, and the icon (and level) opens the icon picker. Eric will name more cases as they come up; don't over-engineer.
- **No browser zoom (Eric, Nov 6):** no pinch or double-tap zoom on phones or computers. The viewport meta has user-scalable=no, plus touch-action: manipulation and iOS gesture blocking.
- **Nov 9: two Opus helpers allowed while XP is built** (XP phases 1–3 all merged Nov 9 ~13:20: back to ONE Opus at a time) (Eric: "I'm debating if we may break our rule of having another, just have
  Opus do it alongside, so we can continue to build other stuff"; then "Yes"). XP's builder is one; at most one other Opus beside it.
  Back to one Opus when XP's phases are done. Other workers stay off the result screens while XP phase 1 is open.

- **Fable (Eric, Nov 11):** at most ONE Fable helper at a time, at `medium` effort, and only when Eric asks for Fable ("if it's Fable, just do one Fable at medium, because otherwise that's going to kill [our usage]").

- **Worktree tests (Nov 11):** a worktree with `node_modules` symlinked to the main checkout resolves `@chessroyale/*` to the MAIN checkout's packages, not the worktree's. For cross-package tests, make `node_modules` a dir of links with `@chessroyale/*` pointing at the worktree's `packages/*` (as done for wt-bz).
- Stills for Eric: the BASELINE is 428x746 (his iPhone 14 Plus in Safari, bars on; Eric, Nov 11), listed first; other widths still tested. Nov 11: a 390x844 still showed the tall home card (name above pawn); his phone shows the short one (pawn left, name right) and he read it as a version mismatch.
- Archive a helper only by the ID its create_session returned (STATUS.md lists them), never an ID read from a PR body or branch: Nov 11 a helper body carried session_01EKH5j59nMnRVnekEcuZbim (Eric's old pinned HunChess chat); archived by mistake, restored within a minute.
- PR #636 frame report opened (bf3c073), CI watcher bhe16a98k; helper session_01JuCWRtcbr9p7G1GSwEGkPH archived.
- Before saying a helper job is still running, check its branch/session (Nov 11: song C was done while I said "in progress"). Brief only what Eric asked: no extra deliverables (Nov 11: an unrequested video over song C).
- Briefs: say "stills go on a stills/<name> branch, never committed under docs/ (check.yml fails the PR)". #654 hit this Nov 12.
- RULE (Nov 12 miss): Boingo pie helper finished 08:37 UTC; director told Eric "still working" for 6 h without checking the branch. Before any status line about a helper, fetch its branch for .done (or get_session). Run a background .done watcher for every running helper.
- The director cannot re-run failed GitHub jobs (403 for this integration). A flake on a PR: fix at cause or ask Eric to press Re-run.
- One Opus helper at a time (Eric, Nov 13: "One Opus builder at a time... no rush"). Overrides the two-at-high allowance until he says otherwise. Haiku jobs may still run beside it.
- Build to live (Eric, Nov 13: "why wouldn't you think I would want this all being put live in the first place?... we'd just be spinning our wheels"). Pre-launch the site is Eric-only behind Cloudflare, so new content ships straight to live, finished end to end: no admins-first gates unless Eric asks, no stopping at a partial version. Mockups only where the LOOK is new and uncertain (his "mockup first" rule), then build it all the way through. Flag any piece that won't work end to end (e.g. solo-only) at the start, not late.
- Complex features: get a whole playable pass live first, start to finish, then polish from Eric's playtest (Eric, Nov 13: "the only way I can truly give you good feedback is testing it from start to finish. Not just going off of screenshots."). Screenshots are for looks; feel and flow come from his play.

- **A ban means you can't sign in** (Eric, Nov 13): "If you're banned, you can't sign in. Just like every other game." Signing in shows only "Your account has been banned. For more information, email support@hunchess.com." Appeals come by email (no in-game appeal box). "Banned" in talk with Eric means this hard ban; the detection pool is "the engine pool" (quiet), never called a ban.

- **Never show players an old version** (Eric, Nov 13: "It should never throw back an old version. It should just fail or something, or we try to reload."). A failure retries the current thing once, then a plain Reload message. No fallbacks to older screens or looks. The old town never loads for a player by any path (Eric: old code is an exploit risk): `?street=off` is test-only; a device without WebGL 2 gets "Chess Town can't run on this device."; a load failure reloads once, then "The town didn't load. Please retry." Both reported.

- **Every running helper gets a send_later check-in (~40 min)** besides its .done watcher (Nov 13: the street-for-everyone helper stalled at 10:20 UTC, a container restart killed the watcher, and nobody noticed for ~6 hours). On each check-in: get_session + the branch's last push; stalled → nudge once, then a fresh helper.

- **Hidden Boss: parallel helpers allowed** (Eric, Nov 13 16:15 UTC: "I want the boss done... Just fire up another worker on it then. I know what I say about one at a time, but come on"). REVISED same day (16:20 UTC): **two helpers at once, in total** ("I just want to run two in total at a time... we don't need five running, that'll kill my usage"). When one finishes, the next paused or queued one starts, until the Hidden Boss is done.

- **A ban locks the whole device** (Eric, Nov 13: "just the whole device is banned... If you get banned and your sister gets upset about it, so be it. We can always revert it later"). No "sign in to another account" on a banned device.
