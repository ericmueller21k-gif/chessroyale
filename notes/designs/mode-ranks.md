# A rank of its own for 50 v 50 and for Squads (design, Nov 16, 2026)

`ranked` lane, design only. Brief: `notes/briefs/mode-ranks-design.md`. Read against main at c17703c.

**Eric, Nov 16:** "It's always ranked. There is no unranked unless it's a private lobby. When you play a 50v50 or squads it also counts
toward your rank for that mode"; "each has their own rank in profile". The Nov 9 design (`docs/ideas/ranked-ladder.md`) already has
Eric's calls on one rank per mode, MMR shown, the leave rules and seasons. This page updates its T1-T3 phases to today's code and to
"always ranked", and changes one recommendation of mine (the math, section 2c).

## 1. What each mode can reuse, and what it lacks

| Reuse as is | From |
| --- | --- |
| Tiers, divisions, 80 RP a division, the top two tiers (top 500 / top 100 from 2800), emblems, `RankView` labels and pills | core `ranked.ts`, `RANKED_1V1`, `RankEmblem` |
| Glicko-1 (start RD 350, floor 60, idle growth), the RP rule `40 × (result − expected)` + catch-up within ±10, placements capped at Radiant 5 | core `ranked.ts` |
| Placement count, the ladder integer, peak, streak, the top tiers' `COUNT(*)` on a ladder index with a minute's cache | `ranked_1v1`, `ranked-schema.ts` (`topPlace`, `rankOf`) |
| Leave marks with a `mode` column, the 90-day purge, fees `LEAVES.leaveRp` / `dodgeRp` | `ranked_conduct`, core `ranked-leaves.ts` |
| One results row per human per match, written from a keyed, retried queue (leavers at once, everyone else at the end) | `results`, `lobby-do.ts` (`queueResults`, `writeResults`), `squads-do.ts` (line ~736) |
| The profile card with its 1v1 / 50 v 50 / Squads menu, Recent Matches rows | `public-profile.ts` (`RANKED_MODES`, "no ranks of their own yet") |
| Fair play's hold (a held player's rank doesn't move), bans (no card) | `ranked.ts`, `fairplay.ts` |

**What they lack:** a rating and ladder per mode (`ranked_1v1` is 1 v 1 only); a match result turned into "how many did you beat";
RP on the result screens; the card's two other menu entries. 50 v 50 today moves only the move-quality **Rating** (`users.rating`, the
profile's "Rating 1612"), and only when 30% of seats are real (`isRankedMatch`). Squads writes `ranked: false` and pays coins and crates.

## 2. The proposal

### a. What moves your rank

- **50 v 50: your own placement among the real players.** Placement is already move quality alone (Eric, Oct: "winning the game goes
  on your record, not your score"); the team's win stays on the record. Your result = the share of the real players you finished ahead
  of (ties half).
- **Squads: your squad's place of 8**, the same for every member (1st, 2nd, 3rd-4th tie, 5th-8th tie), as team games do. Your result =
  the share of the other real squads it finished ahead of. A squad's strength for the expected result is the mean of its 4 seats: a
  person's MMR, a bot's fixed rating (`botRatingOf`), a seat that changed hands mixed by the share of halves each played.

### b. Who counts (bots, parties, `rankedShare`): "always ranked"

- **Every public match counts** (Default queue, parties). Private and test lobbies, solo, raids and Classic never do.
- **You're compared only with real players outside your party** (50 v 50) or real squads other than yours (Squads). Bots never count
  as opponents and their ratings never move (the lane's rule). A party can't feed a friend: friends aren't in each other's comparison.
- **Fewer real players, smaller move** (below): one other real player is about one 1 v 1 game's worth; a full field is a few games'.
- **Nobody to compare with** (alone with bots, or only your party): "No rank change: no other players" on the result, and it isn't a
  placement match. This replaces `rankedMinHumanShare` for the mode ranks. The 30% rule stays only for the move-quality Rating.
- **Leaving** (Eric's Nov 9 rules, "as written"): before move 1 a dodge (−5 RP, a mark, no MMR change); after, a leave (the place you
  had, which is already the last still open, as a real loss, then −10 RP and a mark); none once you're cut or your squad is out; 50 v
  50's AFK removal is a leave. A teammate's leave in Squads is handled by the seat mix above (the bot in the slot lowers your squad's
  expected result, so a loss costs less): no separate "loss halved" rule. The marks go in `ranked_conduct` with the mode.
- **Fair play's hold** as in 1 v 1: a held player's rank stays; everyone else's match counts.

### c. The math (one engine for every mode)

Glicko-1, as 1 v 1, with the match as one rating period against the field. For player *i* and each opponent *j* in the comparison
(a person, or a squad by its strength): `s = 1 / ½ / 0` for ahead / tied / behind, `E` the Glicko expected score, each pair weighted
`w = min(1, c / n)` (n opponents; `c` = a whole match's worth in games: 50 v 50 **3**, Squads **2**, the sim sets them). Then the usual
`d²` and `r' = r + q / (1/RD² + 1/d²) × Σ w g (s − E)`. Settled (RD 60), a 50 v 50 with 60 real players moves about ±28 MMR from top
to bottom; a 1 v 1 win is +10.

**RP:** `40 × (S − E)` + catch-up, `S` and `E` the averages over the opponents: ±20 a typical match, like 1 v 1. Finishing above
expected never takes RP, below never gives it.

**Why not OpenSkill** (my Nov 9 pick): this reuses the tested Glicko-1 with no new package, keeps every mode's MMR on one scale, and
each player's change depends only on the field's snapshot read at join, so it fits today's per-player results queue (a leaver written
at once, 100 keyed writes, any order, any retry). Plackett-Luce would need everyone's result before anyone's write. If the sim shows
slow convergence, OpenSkill is the fallback.

**Seeding** (Nov 9's anti-smurf): 50 v 50 from the move-quality Rating (clamped 800-2400), else the 1 v 1 rating, else 1500; Squads
from the 1 v 1 rating, else the Rating, else 1500. RD 350.

### d. Placements, ranks, seasons

- **3 placement matches** in each (long matches, each comparing you with many people), then placed from MMR, at most Radiant 5.
- The same tiers, emblems and ladder mapping as 1 v 1; Pearlescent and Transcendent are the top 500 and top 100 **of that mode**.
- **Seasons alike:** a `season` column from day one (1); the season job (phase S1, not built for 1 v 1 either) resets all three modes
  on the same dates. Nothing else now.
- **Coins and crates unchanged** (Squads' rewards, 1 v 1's coins).
- **MMR shown** beside each mode's rank (Eric, Nov 9). The profile's "Rating" stays the move-quality number; hub's copy keeps the two apart.

## 3. Stored data (full lane)

Additive; nothing existing changes meaning. Schema at runtime as today (`CREATE TABLE IF NOT EXISTS`, re-runnable `ALTER TABLE`).

- **`ranked_modes`** (new): `user_id, mode ('crowd'|'squads'), rating, rd, games, placed, wins, ladder (null until placed), peak,
  streak, last_at, season`; PK `(user_id, mode)`; index `(mode, ladder)` for the top tiers. 1 v 1 stays in `ranked_1v1`.
- **`results`** gains `rp` (the points it moved; null: none), `ladder_after`, `mmr_after`, `rank_note` ('alone', 'held', 'left',
  'paused'; null), `rank_nonce`. The rank update rides in the result's own keyed batch: the `ranked_modes` row changes only if this
  write's results row went in (its nonce) and the row's `games` is what was read (else read again and retry, as `recordDuel` does).
- **`ranked_conduct`**: no change (mode 'crowd' / 'squads'; `match_id` = lobby code and its created time).
- **No backfill.** Everyone starts "Placement 0/3" in both modes; old matches had no field snapshot to rate against.
- **The lobby record** keeps each human's mode MMR and RD read at join (as `joiningProfileOf` reads `users.rating`), never an app's number.
- **What the profile reads:** `/api/profile/:id` and `/api/me` add `rankedModes: { crowd, squads }`, each a `RankedSummary` or null
  (banned), with `wins` = squad 1st / 50 v 50 final four; `recent` rows carry `rp`. Results and Squads messages get an optional
  `rank { before, after, points, note }` per player, sent when that player's write lands ("Updating your rank…" until then).
- **Accounts:** `ranked_modes` in `ACCOUNT_STORES` (download, delete), a guest's merge as `ranked_1v1`, `SCHEMA_COLUMNS` pinned,
  the privacy policy's ranked line.

## 4. The build, in order (one `xhigh` helper at a time)

| Step | What | Lane, effort |
| --- | --- | --- |
| M1. Math | `core/ranked-modes.ts` (field Glicko, RP, weights, squad strength, seat mix, seeding), `RANKED_MODES` in settings.ts, unit tests; one sim run (`packages/sim/scripts/mode-ranks-sim.ts` → `reports/mode-ranks.md`: convergence, tier spread, a party throwing for a friend, few humans, bot-heavy lobbies) | ranked, targeted, xhigh |
| M2. 50 v 50 recorded | the table and columns, the join snapshot, the rank in `writeResult`'s batch, leaves and dodges, held, a `PAUSE_MODE_RANKS` kill switch, account data, the profile API, the optional `rank` field | ranked, **full lane** (`full-e2e`), xhigh |
| M3. On screen | a shared `RankChange` row lifted from `Duel.tsx` (fixed height), 50 v 50 Results' rank line, home's RANKED row line per mode, the profile card's menu filled, Recent rows' RP, the FAQ | hub (+ director for Results), targeted, high |
| M4. Squads | the same through `squads-do.ts`'s result write (`ranked: false` goes), squad strength and seat mix, the seat badges showing the Squads rank, the rank line on Squads' cards | ranked + director, **full lane**, xhigh |
| Later | L1's lockouts and delayed queue on these queues; seasons (S1) for all modes; MMR in Squads' lobby forming; a party rank-gap limit if fair play sees boosting | ranked |

**Risks.** (1) 50 v 50's rank rests on the judge's scores from players' devices: RP raises the stakes of bending them (`engine` and
`fairplay` should look before launch; the lane's rule "no ranked launch until scoring is trustworthy" applies). (2) Squads' bot seats
rate on the move-quality scale, mixed into a squad's strength: the sim checks the bias. (3) Few players pre-launch means small fields:
the weights keep the moves small, and the first season's tiers may bunch (one settings edit per mode, Nov 9). (4) 100 more row updates
per 50 v 50, in the writes already made: no new D1 load to speak of. (5) Old apps ignore the optional fields.

## 5. Questions only Eric can answer (each with my default)

1. **50 v 50: rank by where you finish (your moves), not by whether your team won the game?** Default: **yes**, as your "winning goes
   on your record, not your score".
2. **"Always ranked" and bots:** every public match counts, but you're only measured against the real players outside your party; a
   match with fewer real players moves you less, and one with nobody real but your party moves nothing (the "fewer than 30 real players:
   unranked" line goes). Or should bots count too, at their fixed strengths? Default: **real players only**.
3. **Placements: 3 matches in 50 v 50 and Squads** (5 in 1 v 1)? Default: **3**.
4. **Squads: the whole squad gets the same result** (its place of 8), however each member played? Default: **yes**.
