# A rank of its own for 50 v 50 and for Squads (design, Nov 27, 2026)

`ranked` lane. Builds on the Nov 16 design (branch `design/mode-ranks`, `notes/designs/mode-ranks.md`) and the 50 v 50 rework's
places (`design/crowd-rework`, C5), updated to today's main. PR 1 (the pure math) is on this branch; the rest is the plan below.

**Eric's words.** Nov 9: "one rank per mode is perfect"; a ranked leaver's seat is taken by a bot at that player's strength.
Nov 16: "When you play a 50v50 or squads it also counts toward your rank for that mode"; "Squads do yes cause each has their own
rank in profile"; the RP from your placement and your engine score, judged against the lobby's average ("100 super strong
players... you should not lose a lot"); Squads' RP "entirely on your placement". Nov 25: "a ladder board for all rank modes".

## 1. What is reused as is

| From 1 v 1 | Where |
| --- | --- |
| Glicko-1 (`expectedScore`, `ratingNow`: start RD 350, floor 60, idle growth 18 a day) | core `ranked.ts`, `RANKED_1V1.rating` |
| The ladder integer, tiers and divisions (80 RP), the top two tiers (top 500 / top 100 from 2800), `rankView`, emblems, pills | core `ranked.ts`, `RankEmblem` |
| The RP rule `2 × perGame × (S − E)` + catch-up `0.05 × (hidden − ladder's rating)` within ±10, placements capped at Radiant 5 | `pointsFor`, `placeLadder` |
| The top tiers' place (one `COUNT(*)` on a ladder index, a minute's cache), the season ladder page and `LEFT_OUT` | `ranked-schema.ts` (`topPlace`), `ladder.ts` |
| Leave and dodge marks with a `mode` column, their fees and 90-day purge | `ranked_conduct`, `LEAVES` |
| One results row per real player per match, written from the lobby's keyed, retried queue | `results`, `lobby-do.ts`, `squads-do.ts` |
| The profile card's 1v1 / 50 v 50 / Squads menu (two of its entries empty today) | `app/src/public-profile.ts` (`RANKED_MODES`) |

Every mode's settings are `RANKED_1V1` with its own placements and points (core `modeRankSettings(mode)`), so `rankView`,
`placeLadder` and `pointsFor` take them unchanged and every mode's hidden rating is on one scale.

## 2. How a match becomes RP

### a. Who you're measured against

- **Real players only.** You're compared with each real player in the match **outside your party** (50 v 50), or each other squad
  with **at least one real player** in it (Squads). Bots never count as opponents and their ratings never move (the lane's rule); a
  party can't feed a friend, since friends aren't in each other's comparison.
- **Nobody to compare with** (alone with bots, or only your party): no rank change ("No rank change: no other players"), and it
  isn't a placement match. This replaces the 30% rule (`RANKING.rankedMinHumanShare`) for the mode ranks; the 30% rule stays only
  for the move-quality Rating.
- **Which matches:** every public 50 v 50 and Squads match. Private and test lobbies, solo, raids and Classic never count.

### b. Your result against each opponent (S)

**50 v 50: placement and engine score.** For each real opponent *j*:

`s = placeWeight × place part + scoreWeight × score part` (0.7 and 0.3, in settings)

- **Place part:** 1 if you finished ahead of *j*, ½ on an equal place, 0 behind. The places are the rework's (those still in at the
  end, the winning side's first, then each cut back by their score at it), so winning the game counts as it does today.
- **Score part:** your points a move (the judge's loss a move, the results' `perMove`; lower is better) against *j*'s: 1 if lower by
  more than `scoreBand` (0.1), ½ within it, 0 if higher. If either of you played fewer than `scoreMinMoves` (6) counted moves, or
  either has no score, the score part is the place part.
- **Why the score part:** the rework's sim found the cuts mostly luck with today's players (rank correlation 0.1-0.32); a whole
  match's points a move is the steadier sign of skill, so a strong player cut on a near-tie isn't charged a full loss. It also
  stands in for the rework's "tie band" (a pair split by a cut within 1 point counting as a draw), which would need every survivor's
  score at every cut: the same effect, from numbers the results already carry.
- **A leaver** gets the place part only (no credit for a good score before leaving): the last place still open, as today.

**Squads: placement only** (Eric). Your squad's place of 8 (1, 2, 3 = 3rd-4th, 5 = 5th-8th) against each other counted squad's: 1
ahead, ½ equal, 0 behind. Every member gets the same result.

### c. The expected result (E): "judged against the lobby's average"

`E` against each opponent is Glicko-1's expected score from the two hidden ratings (the opponent's uncertainty flattening it), and
your match's `E` is its average over the field: your expected share of the lobby. In a lobby of 100 super strong players a weaker
player's `E` is small, so finishing low costs little and finishing high pays a lot.

- **A squad's strength** is the mean hidden rating of its 4 seats: a person's Squads rating; a bot's its fixed rating
  (`botRatingOf`). The opponent counted is the squad; its bots only shape its strength. Your own squad's strength is yours for `E`.
- **Read once, at join:** each real player's mode rating, deviation and record is read into the lobby when they take their seat
  (as `joiningProfileOf` reads `users.rating`), never from an app. Each player's update depends only on that snapshot and the
  places, so each results row can be written alone, in any order, retried.

### d. The hidden rating and the RP

- **Hidden rating:** Glicko-1 with the match as one rating period against the field, each pair weighted `w = min(1, fullField / n)`
  (`n` opponents; `fullField` 3 in 50 v 50, 2 in Squads: a whole match is worth about that many 1 v 1 games, however many play).
- **RP:** `2 × perMatch × (S − E) × min(1, n / fullField)` + the catch-up, `S` and `E` the field's averages. `perMatch` 20: about ±20
  for a typical match with a full field, as a 1 v 1 game; one other real player, a third of that. Finishing above `E` never takes
  RP, below never gives it, and a 1st place never loses any.

| Case (settled players, 50 v 50, a full field) | E | Place | RP |
| --- | --- | --- | --- |
| You 1500 among 1500s | 0.50 | middle (S 0.50) | 0 |
| You 1500 among 1500s | 0.50 | last (S 0.00) | −20 |
| You 1200 among 1900s (Eric's "super strong" lobby) | 0.14 | last (S 0.00) | −6 |
| You 1200 among 1900s | 0.14 | top 10% (S 0.90) | +30 |
| You 1900 among 1200s | 0.86 | top 10% (S 0.90) | +2 |

(Before the catch-up, which moves a rank toward its hidden rating by at most 10.)

### e. Placements, seeding, leavers, holds

- **Placements:** 3 counted matches per mode (each compares you with many players; 1 v 1 has 5), then placed from the hidden rating,
  at most Radiant 5 0. "Placement N/3" until then.
- **Seeding** (anti-smurf): 50 v 50 from the account's move-quality Rating (`users.rating`, clamped 800-2400), else the 1 v 1
  rating, else 1500; Squads from the 50 v 50 rating, else the 1 v 1 rating, else the Rating, else 1500. RD 350.
- **Leaving** (Nov 9's rules, as 1 v 1): before move 1 a dodge (`dodgeRp`, a mark, no hidden-rating change); after it a leave (the
  last place still open as the result, then `leaveRp` and a mark); nothing once you're cut or your squad is out. 50 v 50's away
  removal is a leave. The marks go in `ranked_conduct` with mode `crowd` or `squads`.
- **A leaver's seat** (Nov 9): the bot that takes it plays at the leaver's own mode rating (`leaverBotSkill`: the temperature that
  plays like it, `botSkillForRating`), not today's fixed `botSkill` 4. In Squads this keeps the squad's strength as it was read, so
  the teammates' `E` stays right with no mixing of seats.
- **Fair play's hold:** a held player's rank doesn't move; everyone else's match counts as usual.

## 3. Stored data (full lane; the smallest that works)

- **`ranked_modes`** (new): `user_id, mode ('crowd' | 'squads'), rating, rd, games, wins, ladder (null until placed), peak, last_at`;
  PK `(user_id, mode)`; partial index `ranked_modes_board (mode, ladder DESC, user_id DESC) WHERE ladder IS NOT NULL` (the ladder
  page and the top tiers' `COUNT(*)`). `wins` = 1st places (the podium's winner; a squad's 1st). No season column: 1 v 1 has none
  either, and the season job (S1) adds one to every ranked table at once. 1 v 1 stays in `ranked_1v1`.
- **`results`** gains `rp INTEGER` (the points that match moved; null: none, in placements or held) for the profile's Recent rows.
- **One write:** the rank update rides in the results row's own keyed batch, guarded on the `games` read (compare-and-set, as
  `recordDuel`), so a retry can't count a match twice.
- **Accounts:** `ranked_modes` in `ACCOUNT_STORES` (download, delete), a guest's merge as `ranked_1v1`, `SCHEMA_COLUMNS` pinned, the
  privacy policy's ranked line. No backfill: everyone starts at "Placement 0/3" in both modes.

## 4. On screen (hub and the director)

- **The 50 v 50 podium:** "— RP · ranks soon" (`Podium.tsx`) becomes your rank and its change ("Gold II – 45 (+18)", "Placement
  2/3", "No rank change: no other players"), in the same fixed box. Squads' result card the same.
- **The profile card:** the menu's 50 v 50 and Squads entries show that mode's rank, games, 1st places and peak; Recent rows their RP.
- **Home:** the RANKED row's line reads the picked mode's rank.
- **The ladder:** `GET /api/ladder?mode=50v50|squads` from `ranked_modes_board`, the same page with the mode picked; the top tiers
  per mode (top 500 / top 100 of that mode).
- **The FAQ:** the ranks entry gains a line per mode (quoted from settings).

## 5. The PRs

| PR | What | Lane, effort |
| --- | --- | --- |
| 1 | **The math** (this branch): core `mode-ranks.ts` (pair results, the field's Glicko-1, RP, a squad's strength, placements, seeding, the leaver bot's skill), `MODE_RANKS` in settings.ts, unit tests. No stored data, no screens | ranked, targeted, xhigh |
| 2 | **Measure:** `packages/sim/scripts/mode-ranks-sim.ts` → `reports/mode-ranks.md`: convergence from 1500, the tier spread, Eric's three lobby cases, a party throwing for a friend, few real players, bot-heavy Squads; the weights tuned in settings | ranked, targeted, high |
| 3 | **50 v 50 recorded:** the table and column, the join snapshot, the write, leaves, the leaver bot at its level, a `PAUSE_MODE_RANKS` kill switch, account data and privacy, the results message's optional `rank`, `/api/ladder?mode=50v50`, the profile API | ranked, **full lane**, xhigh |
| 4 | **Squads recorded:** the same through `squads-do.ts` (its `ranked: false` goes), a squad's strength from the join snapshot, `?mode=squads` | ranked + director, **full lane**, xhigh |
| 5 | **Screens:** the podium's and Squads' rank line, the profile card's entries, home's line, the ladder's mode pick, the FAQ | hub + director, targeted, high |

**Risks.** (1) 50 v 50's RP rests on the judge's scores from players' devices, and the score part raises their stakes: `engine` and
`fairplay` look before launch ("no ranked launch until scoring is trustworthy"). (2) Squads' bot seats rate on the bot curve's
scale, mixed into a squad's strength: the sim checks the bias. (3) Few real players pre-launch: the weights keep moves small, and the
first season's tiers may bunch (one settings edit per mode). (4) About 100 more row updates a 50 v 50, inside writes already made.

## 6. Calls made (Eric can reverse any)

1. Real players only, outside your party; no other real player: no change (the Nov 16 default; the lane's rule).
2. 3 placement matches per mode.
3. 50 v 50: 70% placement, 30% engine score (Eric's "placement and engine score"); Squads 100% placement (Eric).
4. The score part replaces the rework's tie band (the same purpose from numbers already in the results).
5. No season column yet (none for 1 v 1 either).
