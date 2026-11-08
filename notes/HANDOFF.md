# Director handoff (start here)

You are the **director** for HunChess (repo `ericmueller21k-gif/chessroyale`; main auto-deploys to hunchess.com).
Eric owns it. You design, delegate to helpers, review, merge, check what's live, and report. Small fixes you do yourself.

## Read first (in this order)
1. `notes/RULES.md`: standing rules (usage, models, merging, security, attribution). They bind you.
2. This file: the live state as of the last handoff.
3. `notes/STATUS.md` (newest entries at the bottom) and `notes/CHANGELOG.md`, only as needed.
4. Briefs: `notes/briefs/*.md`.

## Setup in a fresh container
- `git clone` chessroyale; `git worktree add ../cr-notes claude/director-notes` (or fetch that branch).
- Copy `notes/tools/wait-ci.sh` and `notes/tools/wait-version.sh` to your scratchpad. Run them in the background
  (timeout 7200000): `wait-ci.sh <full 40-char sha>`, `wait-version.sh <12-char sha>`.
- Helpers: each gets its own worktree, runs `npm ci` in it, and uses its own E2E_PORT (build, then E2E_PREBUILT=1),
  `flock /tmp/claude-0/e2e.lock`.

## How helpers run now (Nov 8 audit: notes/throughput-audit-2026-11-08.md)
- Each helper is its own cloud session on its own machine (`create_session`). No shared e2e lock. CI is the second
  lane (push early; `notes/tools/ci-fail.sh <sha>`). Stills come on `stills/<PR#>` branches.
- Pilot: #551 result screen, session_01JuCWRuSgqDxoUzeqE4thSP (started 03:30 UTC). Subagents on this machine:
  #554 Locker and #553 Dash clock (started ~03:25; their results go to the old director session; check their branches).

## Usage lessons (Nov 8: about 30% of the week was gone by Saturday)
- One Opus helper used about 4× what four Haiku helpers used together (672 turns, ~254M cache reads). The director's long
  context was the next biggest cost.
- Five helpers queued on one e2e lock. One ran `--repeat-each 10` for 30+ min while the others polled every 2 min (each poll is a
  full turn). Rules from now on:
  - **at most 2 helpers at once**;
  - **Opus only for hard or risky work**;
  - **a fresh helper per job** with a short brief;
  - **one blocking wait** (Bash timeout 600000), never short polls;
  - **`--repeat-each` ≤3** unless Eric OKs more;
  - **start a new director session** when the context gets big; this file makes that cheap.

## Live now (main) — see STATUS.md's Nov 8 overnight entry for the latest (#551, #553, #554, #555, #556, #557 all live)
- #552 home card taps (d7325418): icon → icon editor, name → your public profile, the big pawn still opens the inventory
  (Eric confirmed Nov 8).
- #550 typed chat + right column, computer (merged f08e31e3, Nov 8 ~03:45 UTC): 8 pixel emoji, opt-in
  (`users.chat_on`), limits (5 s per player, 80 chars, filter, 5 msg/s server-wide), Settings CHAT switch. Removed:
  the top-right avatar, Playing now, the friends list, the quick-chat tabs, the room Back bar. **Verify the deploy and main CI on f08e31e3 first.**

## In flight (branches pushed; no helper running; relaunch with fresh Haiku helpers, 2 at a time)
- **#551 result screen** `claude/result-screen` @ ff09213b (layout + talk sequence + no solo Unranked line committed; boss-result.spec green on both projects). FAILING:
  formats.spec "God King's Last Stand" never sees `.results-duo .boss-char .bc-bubble`, on both projects (check that the row renders / the selector). Not done:
  the boss facing (nothing flipped; only Smudgy is mirrored today; needs a larger 17-boss render), the stills last-stand-phone-1-boss/-2-godking,
  and a retaken defeat-phone.. Eric liked victory-phone. His newest asks (Nov 8):
  - delete the "Unranked: solo games don't count" line on boss results (keep the online "fewer than N real players" line);
  - Last Stand layout: the boss on the LEFT; the God King + your pawn on the RIGHT, one row; "You beat X!" under it; then the Last
    Stand card;
  - the bubbles are a conversation: the boss's line, a beat, it fades, then the God King's reply. Never both at once; timings in
    settings.ts;
  - the boss faces right, toward the God King. Mirror the image only, pixel-crisp. Check all 17 bosses (flips sheet); don't flip
    any whose art reads wrong;
  - e2e number checks: order, never both visible, bounds [16, vw−16];
  - retake defeat-phone with the bubble fully opaque.
  Stills go to Eric before merge.
- **#553 Dash clock** `claude/dash-clock` @ a3839fa3 (fix committed; e2e + GIFs NOT yet re-run). Fix: the pop-off line, then the love line, then his move lands (the love line never showed);
  the move list must not show his move before the board; 10 fast smacks; e2e order + count checks; remade GIFs to Eric
  before merge.
- **#554 Locker default pawn** `claude/locker-default` @ 677be69d. All asks below are built (W/B 24 px, selected 27.5, 8 px insets,
  32 px hit area; GOD_KING_SHOP=false; town pawn plain black). The e2e for the new size and the God King hiding, and the stills, are NOT done yet.
  Open question for Eric: the "God King pack" quick-chat pack still shows in the shop's chat tab. Hide it too? (full-e2e; stored pref `users.pawn_color`, xhigh rules).
  Eric's newest asks (Nov 8):
  - W and B are two separate small buttons tucked into the bottom-right of the blue box, ~30% smaller than the 02:50 still
    (~24 css px); the selected one ~15% bigger;
  - no "default" word;
  - the off-white outline on the black pawn only in the Locker; **the town pawn stays plain black**;
  - remove every trace of the God King from the shop UI (the Locker's "From the shop" / Holy Light card, "More God King
    effects", any Shop listing) behind a settings switch. Don't delete data or owned items.
  Stills (locker W/B phone + computer, shop-phone) go to Eric before merge.
- **typed-chat-2** `claude/typed-chat-2` (through 35ae64b8; no PR): typed chat in match + lobby and on phone. Mostly
  built; unit + e2e passed locally. **Paused for usage: start only when Eric says go.** Merge main (#550) into it first.
- **Timber tap test** `claude/fix-timber-tap` (8efd0033, test-only, no PR): the camera was still moving when the test
  tapped. Failures went from 7/10 to 4/20 under load; 2 "drawn but untappable" remain (likely a figure/house covering).
  Next: capture one failing dump (`--repeat-each 3 --workers 2`), then decide. Low priority.

## Queue after that (Opus, one at a time, Eric's order)
1. The Smudgy ult never fires (guarantee once a game) + a report only on whether our engine can truly paint/swap a piece.
2. The auto chess redesign (`notes/briefs/brief-autochess-redesign.md`, approved).
3. The town intro (welcome + TOWN tools slide).
4. Intermittents: squads-watch:167, squads-three-boards:152, dash:241, town-leave:143.

## Waiting on Eric
- Result screen stills (#551), Dash GIFs (#553), Locker + shop stills (#554): sent to him as each is ready.
- The settings mockup. Whether to start typed-chat-2. Whether the "God King pack" chat pack leaves the shop too.

## Later / ideas
- ROADMAP (Eric, Nov 8): custom quick chat. Each player writes up to 10 of their own quick-chat lines in their profile
  (a character limit, the chat filter, appropriate only), quicker than typing mid-game. Until then: 10 default lines. Stored
  user text that others see = moderation + xhigh rules. Open question: do chat packs (the Winter pack etc.) stay?
Spread the boss homes (no two neighbors); other bosses face away until on the kit; the ledger (shelved); Dash's clock as a
legendary item; other players' pawn color on queue/squads/boss-select cards; God King shop items (Eric will revisit).
