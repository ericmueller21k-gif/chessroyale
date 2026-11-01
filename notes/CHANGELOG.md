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
| H1 | Blitz (cheetah): Clock Slap passive, Time Scramble ult, tortoise sidekick | approved; art done; game build after art approval |
| H2 | Timber (beaver): workshop strip, scraps, Gnaw ult, woodpecker foreman | approved; art done; game build after art approval; beaver size: waiting on Eric |
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
| L1c | Eric approved the redo's stills (Nov 1: "I think we have gotten it") | **#446** merging when CI is green |
| M1 | **Eval bar off for everyone** (Eric, Nov 1: "it should never actually be displayed… keep it in the settings for now, but disable it… nothing gets resized"). It was testers-only already, so players see no change; the Testing row stays, disabled; the Colosseum's spectator bar stays *(mine)* | **BUILDING** (Haiku) |
