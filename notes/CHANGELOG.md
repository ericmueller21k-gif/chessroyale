# Eric's notes log (rebuilt Nov 1, 09:20 UTC)

The container restart at about 05:10 UTC Nov 1 wiped the scratchpad, so this log was rebuilt from the director's
summary and the session's recent history. Wording of older rows is shorter than the original; nothing Eric asked for is
dropped. *(mine)* marks the director's own suggestions.

## Standing rules from Eric
- **Approval rule (Oct 31):** rare items and rides: design → Eric OK → API draws → drawing to Eric → OK → into the game.
- **Ride review format (Oct 31):** one GIF per ride: run left, right, up, down quickly, then the idle. No contact sheets.
  A ride fits within 125 units wide (≈1.8 squares; 100 units = the pawn's box, drawn 1.45 squares wide).
- **Ride trails (Oct 31):** only while running; a ride's trail replaces the town's droplets; each ride has its own.
  *(mine: seen only by you, like the droplets.)*
- **Models (Nov 1):** Haiku for UI, docs and simple jobs; never Sonnet. Opus for rules, engine, art, reviews.
- **API credits (Nov 1):** conserve; ~$54 left until the refresh (~20 days). Only Eric-approved art, tight caps.
- **Audit fixes (Nov 1):** "go ahead… I'll let you orchestrate the fixes you think will help".
- **Ride size (Nov 1):** "0.75 is good, I have a feeling most we will scale to that".

## A. Home
| # | Note | Status |
|---|---|---|
| A1 | Boss Arena → **Chess Town**: CHESS TOWN button the size of PLAY, centered text; "Other modes": Boss Battle (boss faces) and Auto chess side by side; town picture A/B 50/50 each load | **LIVE** #433 |
| A2 | Home mockup for ChatGPT | done |
| K1 | Chess Town by time of day: day 06–17, dusk 17–19, night 19–06 (lights on) | **LIVE** #434 |
| K2 | Later: subtle animation on the home's main buttons; hover effects on a computer | later |

## B–D. In-match fixes (one PR)
| # | Note | Status |
|---|---|---|
| B1 | Light / Dark in the match gear (both platforms) | **LIVE** #436 |
| C1 | Alfil's ultimate banner cut off on a computer; every boss banner checked | **LIVE** #436 (two Sawyer subtitles overhang 4–5 px, glyphs inside) |
| C2 | Ult meter on a computer: thicker, twice as long (88 × 10 px) | **LIVE** #436 |
| D1 | Squads scoreboard: your squad pinned at the top, a thicker line, then the list | **LIVE** #436 |
| D2 | Crowd team table stays dark in Light mode (found by #436) | **MERGED #441** (the team table follows Light mode) |

## E. Colosseum pixel style
| # | Note | Status |
|---|---|---|
| E1 | GBA-style pixel pieces from Eric's picture, all six, both colors | **MERGED #439** (round 2: sizes measured from the picture, slim Staunton shapes, warm outline, four-tone shading); next tweak if needed: finer pixels |
| E2 | Four high views going round the board; opens behind White *(mine)* | built (round 1) |
| E3 | Gear row "Pieces": Pixel (default) / 3D / 2D | built (round 1) |
| E4 | Eric's reference picture | re-sent; kept in the repo (`docs/refs/colosseum-high-view.png`) |

## F. Admins
| F1 | Every admin owns one of every item, now and later; nothing stored | **LIVE** #430 |

## G. Rides
| # | Note | Status |
|---|---|---|
| G1 | Riding Chirp and Moon's Ride in the town | **LIVE** #431 |
| G2 | Front/back views (run up = back, down = front) | **MERGED #442** (rides v2) |
| G3 | Moon's Ride redo | **rejected** ("torpedo shark"); on hold, no more redraws until Eric says |
| G4 | A ride for every boss (12 drafts + Hollow's Bulb instead of the cat) | **MERGED #442** (rides v2) |
| G5 | Brush Ride redo (shorter, black bristles, colored tips) | approved, drawn; plum seat pad keep/drop: waiting on Eric |
| G6 | The "pony" was a test fixture, never a ride | noted |
| G8 | Trails replacing droplets, every ride | **MERGED #442** (rides v2) |
| G9 | Ride size knob + `?rideScale=` admin switch | **merged** #435 (deploying); default becomes 0.75 for every ride in rides v2 |
| G10 | Hollow's Bulb: remove the green cord | **MERGED #442** (rides v2) |
| G11 | Cheetah Shoes (Blitz): 2× town walking speed | **MERGED #442** (rides v2) |
| G12 | Log Roller (Timber) | **MERGED #442** (rides v2) |

## Bosses and the economy
| # | Note | Status |
|---|---|---|
| H1 | Blitz (cheetah): Clock Slap passive, Time Scramble ult, tortoise sidekick | art **APPROVED** (Nov 1); build **after Timber** (Eric's order) |
| H2 | Timber (beaver): workshop strip, scraps, Gnaw ult, woodpecker foreman | art **APPROVED** (Nov 1); **BUILDING** first (Opus, admins first) |
| J1 | Boss tokens: each boss's face on a coin (crest style); Ginger and Blitz examples drawn | waiting on Eric's OK |
| J2 | Token earning: one token per boss per day for playing | design (Opus xhigh) for Eric's OK |
| J3 | Boss shops: contents TBD (not rides) | waiting on Eric's ideas |
| J4 | Keys: Eric to send a key design. Buying keys: needs Eric's payment account, prices, regions/ages | waiting on Eric |
| J5 | Gambling warning on the crate pages ("Crates are chance, like gambling. Only spend money you're okay losing.") | **LIVE** #433; Escape timing fix in #435 |
| J6 | Boss Series Crate #1 wiring | after round 2 art |

## Process (Nov 1)
| # | Note | Status |
|---|---|---|
| P1 | Usage check lapsed since Oct 18; audit run | done (`docs/decisions/2026-11-01-usage-audit.md`) |
| P2 | Helper rules: one wait call, fresh helpers, PRs by the director, local tests only what changed, ~10 images | **LIVE** #437 |
| P3 | Smarter PR test selection; main one run at a time | **merged** #438 (median PR test run 34 → ~10 min) |
| P4 | Speed up the four slowest specs, keeping every check | later |
| P5 | Where the notes live so a restart can't wipe them | **branch `claude/director-notes`** (Eric's pick; public repo) |

## Nov 1 (morning): Eric's three
| # | Note | Status |
|---|---|---|
| L1 | **50 v 50 on a phone:** delete "Your team watched this one"; the middle (power-ups, arrows, status, vote results) is one fixed-height box; the scoreboard flush under it, never moves; header pick **Black · White · All** (your team default; selected white, others grey); drop "tap for all 50" (the ▾ opens the full list). Phone only; desktop later | **MERGED #441** (short phones: the box follows the screen's height, 4 vote bars or top 3 + yours, so the chat keeps room *(mine)*); follow-up: "Wh…" in the split header |
| L2 | **Auto chess TFT economy** (Eric's Oct 25 numbers, ROADMAP; had been "for another day"): pawn 1, knight 3, bishop 3, rook 5, queen 9 *(mine: 9 per "unless 8 or 9 is more true to chess value")*; 4 gold → 4 XP; interest +1 per 10 up to +5; roll 2, 3, 4, 5 cap 5 per round; income 10, +2 a round, up to 20 (sim: TFT's flat 5 would leave 2–3 pieces, since every round rebuys the army) | **MERGED #440**; Eric to feel-test |
| L3 | **Board size on a computer:** Settings "Board size: Large · Compact"; Large = as close to chess.com's 0.889 of the height as fits (shrink bosses/rows if needed), the default *(mine, per "the one people open up the game to")*; Compact = today's (Oct 29). Why today's fell short: a fixed 170–230 px room above/below the board, so a short laptop window gets ~0.72 | **BUILDING** (Haiku); stills to Eric first |
| L3b | **Boss screen on a computer (Eric, Nov 1, after testing):** no title line ("BOSS · move 1" goes; "Move 1" by the boss's name in its bar, or left of "60 moves left"); ⚡ / fish / gear to the right side of the board; the boss's bar right at the top of the window; a smaller bottom gap; the board bigger; **the normal left side menu back on game screens** ("blank-looking boss screen"). **Mockup first** (Eric may send his own) | Mockup APPROVED; **MERGED #443**: side menu on every computer game screen (icons under 1800 px), no board smaller than today, Boss alone 440 → 512 on a laptop, 880 → 952 on 1920 × 1080 |
| L1b | **Eric, Nov 1 on his iPhone after #441: "still all fucked up".** The scoreboard right up against the bottom of the vote results, everything below is scoreboard; chat as a tab: "Black · White · All · Chat", tapping Chat replaces the scoreboard, "‹ Back" returns to the pick you had; the result is ONE line, trimmed. Why it was wrong: the box was sized for 390 × 844, his Safari shows ~390 × 750, so the scoreboard got two rows | **REDO** (Haiku, `claude/crowd-phone-v2`), stills to Eric first; #445 closed |
| L1c | Eric approved the redo's stills (Nov 1: "I think we have gotten it") | **MERGED #446** (58c9dd3) |
| M1 | **Eval bar off for everyone** (Eric, Nov 1: "it should never actually be displayed… keep it in the settings for now, but disable it… nothing gets resized"). It was testers-only already, so players see no change; the Testing row stays, disabled; the Colosseum's spectator bar stays *(mine)* | **BUILDING** (Haiku) |

## Archived from STATUS.md (Nov 2 00:50 UTC)
# Director status (rebuilt Nov 1 09:20 UTC after the container restart wiped the scratchpad)

## Rules (see the summary; key ones)
- Helpers push only; the director opens PRs via GitHub MCP from the helper's pr-body file; unsubscribe PR activity after
  opening (the subscription can arrive late: unsubscribe again on its event); one CI watcher per sha.
- Every brief pastes the Working lean rules (CLAUDE.md since #437). Fresh helper for every round or job.
- After each batch: `python3 .claude/tools/helper-usage.py <tasks dir>` (fixed in #437: counts each reply once).
- Main since #438: one run at a time; a skipped main commit's checks read "cancelled" (covered by the next run; its
  summary lists "The merges this run covers").
- Scripts: scratchpad/wait-ci.sh <sha>, scratchpad/wait-version.sh <prefix> (rebuilt: version.json + /api/status).

## State
- main a2f721a (#438) on top of 60975fa (#435), 878e551 (#436), 97d83ee (#437). Watcher bw982pbdd: deploy + main CI.
- #435 ride size + GamblingWarning Escape fix (useLayoutEffect): merged 60975fa.
- #438 CI selection: merged a2f721a. Check main's first push run summary ("merges this run covers").
- Colosseum pixel round 2: helper running (handoff colosseum-cup/handoff-pixel-round2.md), worktree /home/user/cr-colo-pixel.
- Rides v2: helper running (brief eric-notes/brief-rides-v2.md), worktree /home/user/cr-rides-v2.
- Lost in the restart: Eric's Colosseum reference picture (ask him to re-send), all stills/GIFs, old briefs, the full
  notes log (rebuilt condensed), audit data (the report's findings are in docs/decisions/2026-11-01-usage-audit.md).

## Waiting on Eric
- Re-send the Colosseum reference picture.
- Where to keep the notes log durably (a private doc, or a branch in the public repo).
- Crowd team table in Light mode: restyle?
- Brush plum seat pad keep/drop; beaver size; token examples OK; per-ride sizes after testing; key design; payments setup.
- Nov 1 09:30: Eric's three building: crowd phone scoreboard (Haiku, cr-crowd-board), board size Large/Compact (Haiku, cr-board-size), autochess TFT economy (Opus, cr-ac-econ). Briefs in nov1b/.
- Nov 1 09:35: board-size helper redirected to a MOCKUP of Eric's new desktop boss layout (no title line, icons right of board, bar at top, side menu back). Stop after stills.
- Nov 1 10:00: main a2f721a green + live. 60975fa's main run red: town.spec:1273 'beside you: 22,17' (phone both tries, desktop flaky); a2f721a passed it → intermittent; rides v2 helper asked to root-cause.
- Nov 1 10:15 Eric: build boss screen (helper running, cr-board-size), notes on branch claude/director-notes (cr-notes; copy + push after updates), team table light → in crowd round 3.
- Nov 1 ~10:45: Colosseum round 2 → PR #439 (9d6f57a, CI b372jbqw7); merge when green; ref picture in repo docs/refs/colosseum-high-view.png.
- Nov 1 ~11:00: #439 Colosseum MERGED bd54f83 (deploy/CI blz376ezv). #440 autochess economy opened (0328eee, CI watcher). Crowd round 4 running.
- Nov 1 ~11:15: #441 crowd phone scoreboard opened (cddae0b, CI beiw2juvi). Round 4 helper slip: one send_message call (refused). Earlier helpers: none of the 3 slips touched secrets.
- Nov 1 ~11:35: #440 autochess MERGED 8675efd (after my 2-number test fix). Worktrees cr-ac-econ, cr-colo-pixel removed.
- Nov 1 ~11:45: rides v2 PR #442 (26eb9d5; CI buhmaxtq4); GIFs sent. Follow-up: lazy-load ride drawings (+55 KB gzip main bundle). Fixes main's flaky 'beside you' test (camera settle).
- Nov 1 11:20: wait-ci.sh now also waits for queued workflow runs (a main e2e waiting its turn has no check runs). My slip: a stray './wait-ci.sh 0000000 &' (PID 27319) polls the API ~2/min for up to 80 min, then exits; not killed (PID kills need Eric's OK).
- Nov 1 ~11:50: #441 CI red (4 tests, all branch-caused: round-4 min-height moved phone board 14 px vs main; desktop qunread in new header; panel split layout). Round 5 Haiku helper fixing. Board layout round 2 Haiku helper running (labels ≥1800, narrow columns, no board smaller than today).
- Nov 1 ~11:55: #442 rides v2 MERGED bb5e7a1 (deploy/CI watcher). Next: lazy-load ride drawings follow-up (+55 KB gzip).
- Nov 1 ~12:00: main 8675efd (#440) full e2e GREEN (queued run, new wait script worked).
- Nov 1 ~12:20: #441 round 5 72b8ada fixed board position; blocked on short phones (390×664: 62 px under board, chat feed 0). My call: option (a) middle box height from screen height (200 → ~118), ≥3 bars + yours. Round 6 Haiku running.
- Nov 1 ~12:40: #443 computer game screens opened (8d60f28, CI b4002hc91). Every board ≥ main's at 5 sizes; gaps 1024×768 (−24) and 1800–1856 raid.
- Nov 1 ~12:45: rides v2 bb5e7a1 LIVE (deployed 11:56 UTC) and main full e2e GREEN incl. WebGL town.
- Nov 1 ~13:05: #444 rides lazy-load opened (4480573, CI bwk5i8z84). Helper slip: pkill -f on its own respawning wrangler. Pattern: wrangler dev respawns after fuser -k (seen twice) → give helpers a clean stop recipe.
- Nov 1 ~13:30: #443 CI red (13 desktop tests across problems/resign/autochess/boss-party/boss-character/home-layout/boss-bar/eval-bar/grex/tiger). Round 3 Opus high helper fixing; failures saved in nov1b/board/ci443/failures.txt. Brief now has a wrangler-stop recipe (no pkill).
- Nov 1 ~13:45: #444 rides lazy-load MERGED 26d39e1 (deploy/CI watcher).
- Nov 1 ~14:45: #444 lazy-load LIVE 26d39e1, main GREEN incl. WebGL.
- Nov 1 ~15:30: #443 computer game screens MERGED 3e2c70c (deploy/CI watcher). #441 round 6 CI running (bpvsib32p).
- Nov 1 ~15:45: #441 50v50 phone scoreboard MERGED 19c0fe2 (deploy/CI watcher). Follow-up: 'Wh…' header ellipsis in split layout.
- Nov 1 ~15:55: usage check after the restart: 14 helpers 297M re-read total (top 80M rides v2), 0 Monitor loops: audit rules working. Header 'Wh…' fix helper running (Haiku, cr-crowd-head).
- Nov 1 ~16:30: #443 layout LIVE 3e2c70c, main GREEN. #441 scoreboard LIVE 19c0fe2 (main CI pending, watcher bkqfp7e4a). #445 header fix CI b15stpun1.
- Nov 1 ~16:55 Eric (iPhone, angry): #441 wrong on his phone: 200 px box at his Safari's ~390×750 left 2 scoreboard rows. Wants: box = vote results height, scoreboard fills below, chat as 4th tab (Black·White·All·Chat) replacing scoreboard with Back, ONE result line. Haiku redo (claude/crowd-phone-v2), stills first. #445 closed (superseded).
- Nov 1 ~18:10: 50v50 redo PR #446 (a4faa55, CI bn471cxid); stills sent; MERGE ONLY AFTER ERIC OKs. fuser -k 9441 freed a stray listener (PID 9136).
- Nov 1 ~18:20: Eric APPROVED #446 stills → merge when CI green. Eval bar off for everyone: Haiku helper (cr-eval-off); players unchanged (it was testers-only); admins now same as players; Colosseum spectator bar kept *(mine)*.
- Nov 1 ~18:45: #446 50v50 phone redo MERGED 58c9dd3 (deploy/CI watcher).
- Nov 1 ~19:10: eval-bar-off round 1 113462a: players identical 15/15. Found latent player bug: Babur's pump (no bar) goes to taller slot at 1440/1920, board 832 vs 952. Round 2 Haiku fixing + FAQ line.
- Nov 1 ~19:15: #446 LIVE 58c9dd3 (deployed 17:58 UTC), main GREEN.
- Nov 1 ~19:45: Eric approved Blitz + Timber art; order: Timber first, then Blitz. Timber build helper (Opus high, cr-timber) running, admins-first. Crate session question (Folio crown) → I'll take the no-spend hand fix at crate wiring.

## RULE (Eric; restated Nov 1, ~20:15 UTC): ONE Opus helper at a time
Set in October after ~10 helpers at once used ~30% of a week's usage (docs/decisions/2026-10-19-boss-build-recipe.md).
Lost after the Nov 1 restart; four Opus helpers ran at once. Now in CLAUDE.md (PR "one Opus helper at a time").
Queue (one at a time, in order): Timber (running) → Crowd panel (flash, Black, bot chat, T/emoji chat; worktree
/home/user/cr-crowd-fixes, stopped mid-work) → Crowd cuts (/home/user/cr-crowd-cuts, stopped mid-work, 24 files
changed) → Maia bots (/home/user/cr-maia-bots, stopped mid-work, 14 files) → auto chess reveal (after Eric's OK on a mockup).
- Nov 1 ~21:00 UTC: #448 (cash-in 2 gold) MERGED b84bb92; #449 (one-Opus rule + notes pointer) MERGED b8a0971.
  #447 eval bar: round 4 (director) cb9f74d: profile.spec rides-lazy race (measured "Loading…" layout) fixed in the test.
  Follow-up (not built): the profile page jumps when its data arrives ("Loading…" layout → loaded two-column);
  chat-mod.spec:18 phone flaky once ("GG" from a muted player showed) — root-cause later.
- ~21:45 UTC: main red on b8a0971 = profile.spec rides-lazy race → #452 (test fix) in CI, merge when green.
  #447 eval round 5 needed: hollow.spec:208 desktop "round 3: his box frame 1 off screen 358,0,562,83" (both tries).
  Lights Out prompt (.pm-line.lo-line, bottom:101% of the board, cqw-sized) pokes above the screen top on its first
  frame at the player-size board; SpeechBox's fit check runs once at mount (useLayoutEffect [fit]) and misses a later
  layout change. Main flaky on the same test. NEXT Opus helper after the Timber Haiku fix (one at a time).
- ~22:20 UTC: #452 MERGED 97e49bd (main red fix). #450 Timber r2 (Haiku) 4e7a1df: beside the board on a computer + recluse.test list; CI.
  #447 round 5 592caf8: SpeechBox into-view move rounds away from the edge (Hollow prompt 0.25 px above); CI.
  #451 crowd panel: CI. Cuts and Maia WIP committed+pushed (claude/crowd-cuts, claude/maia-bots).
  NOW RUNNING (the one Opus): cuts round 2 (handoff notes/briefs/handoff-cuts-r2.md). Next: Maia bots round 2.
  Eric open questions: Timber lead rule OK?; solo 50v50 chat column on computer?; move Folio/Babur/Moo corner casts beside the board?
- ~23:00 UTC: main GREEN on 9dfefa1 (#451 live: steady scoreboard, T/😊 chat, bots chat). Restart #2 at ~22:00 (disk kept).
  Open: #447 eval (main merged in 0cca5f8: short-chat CSS dropped, panel.spec emoji via picker; CI), #450 Timber
  (3f81dca: cast back at the corner like every boss; CI), #453 cuts (CI), #454 bots lobby 800-1500 (CI; not Maia: too slow).
  No helper running. Eric questions: Timber lead (2 pawns?), bot ratings scale (chess-site vs scoreboard), test-value review.
- ~23:45 UTC: MERGED #453 cuts (1715dcf), #454 bots lobby (f1082ac), #447 eval bar off (2fbed8e). Deploy + main CI watchers on each.
  Open: #450 Timber (e2f701e: town-bots and boss-select counts; CI). No helper running.
- ~00:00 UTC Nov 2: MERGED #450 Timber, admins first (f2ee8da). All of today's PRs merged. Main CI watcher on f2ee8da.
  Next (Eric's OK first): auto chess reveal mockup; Timber lead rule 2 pawns?; bots rating scale question.
- Nov 2 ~00:30 UTC: TEST-VALUE REVIEW done (report in chat only; helper couldn't write files). Key: full run ~370 test-min
  (~43 min wall) → ~320 (~38); per day ~4,600 → ~3,650 runner-min (−20%). Proposals: speed up boss-bar-same (23 min:
  measure lines at first frame, per-boss tests) and autochess (25.6: ?quick=1, one project for width loops); merge
  formats :108/:300 into crowd-hidden; king-attack desktop 2 widest bosses; town-chat-history, solo phone only; maia :82
  3 rotating bosses; move EvalBar.tsx, prefs.ts, test-switches.ts, Hud.tsx, game.ts from `full` to `traced` (61/94 PR
  runs ran everything); fix 6 flakes (town :167/:1086/:1273, autochess tolerances, helpers.ts:303 route, recluse 950 ms,
  crate-banner :41, chat-mod/lobby-chat) → retries to 0; refresh ci-timings.json. Eric-rule tests never cut.
  Waiting on Eric: OK to do it (one Opus); boss-smoke 3 bosses on non-boss PRs (his rule says every boss).
- Nov 2 ~00:45 UTC, Eric's answers: test changes OK (no boss-smoke trim: GitHub-side and useful); ride scale 0.75 stays;
  Brush Ride: no pad, its trail = ink dripping from the brush's back; auto chess reveal SIMPLER: your placed pieces gray
  until revealed to the opponent, then normal; yellow border = next to reveal; NO green; at the move step all ungray;
  opponent's circles as today (piece-for-piece matching + first-placer concealed still stand); tokens: Ginger/Blitz
  perfect → API run for the other 14 (session_01JuCWRuuJUf92wTLxwR6d8N, asks Eric, ~$4-6, cap $8); beaver size = pick;
  NEW: shops: walk up to a home → zoom like the statues → card "Go in" → interior ~20x20 tiles, auto zoomed in; buy a
  crate with that boss's coins there; prototype Babur's (inside a circus tent), Opus, own scheme. Payments later.
  API runs are outside the one-Opus rule (Eric). Queue (one Opus): test changes (running) → auto chess reveal → Babur shop.
  Haiku job: Brush Ride ink-drip trail.
