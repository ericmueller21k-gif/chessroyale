# Ranked 1 v 1: Puzzle Pirates' tiers, five divisions of 80 RP, the top 500 and top 100, and the emblems (Oct 28, 2026)

How it works now: [docs/areas/ranked.md](../areas/ranked.md), "Ranks" and "The emblems". Every number is in
`RANKED_1V1` (`packages/core/src/settings.ts`).

## Eric's words (Oct 28)

- "Maybe we can do puzzle pirates for some actually, wood, silver, gold, paragon, illustrious, sublime, radiant,
  pearlescent (top500), transcendent (top 100)"
- "each tier has numbers 1-5 within it wood 5 being the lowest etc"
- "yes 80 per division"
- The emblems: a chess piece in a cut-gem badge, five divisions that grow grander (5 plain, 4 studs, 3 wings, 2 crown
  crest, 1 gem crown and wide glow); Pearlescent and Transcendent are 2 s loops. "I like option C" (division 1's gem
  crown). The drawing: `scripts/boss-art/out/rank-set/rank-set.ts` on `claude/boss-art` at a8d5aa57, brought in as drawn.

## Old → new

Each old tier spanned 400 ladder points (4 divisions × 100); each new tier spans the same 400 (5 × 80). So the stored
ladder number keeps its meaning and nothing stored changes: 7 × 5 × 80 = 2800 = 7 × 4 × 100.

| Ladder | Before (Oct 16) | Now |
| --- | --- | --- |
| 0-399 | Iron 4 … 1 (100 each) | Wood 5 … 1 (80 each) |
| 400-799 | Bronze | Silver |
| 800-1199 | Silver | Gold |
| 1200-1599 | Gold | Paragon |
| 1600-1999 | Platinum | Illustrious |
| 2000-2399 | Emerald | Sublime |
| 2400-2799 | Diamond | Radiant |
| 2800 + | Master (0 RP), Grandmaster (200), Champion (500): by points | Pearlescent (top 500), Transcendent (top 100); else Radiant 1, its RP counting on past 80 |

Examples: 0 is Wood 5 · 0 RP (was Iron 4 · 0); 1245 is Paragon 5 · 45 RP (was Gold 4 · 45); 2400, the placements' cap,
is Radiant 5 · 0 RP (was Diamond 4 · 0); 2815 is Radiant 1 · 95 RP outside the top 500 (was Master · 15).

**Unchanged:** `baseRating` (800), `ratingPerPoint` (1600/2800), the points a game, the expected-result formula,
placements and their `maxLadder` (2400), pairing and coins. The test "stored data keeps its meaning" walks every ladder
from 0 to 4000 against the old formula, written out in the test. The ranked sim gives the same ladder numbers as
before for its seed (every player's ladder after every game, compared byte for byte: identical); only the tier names in
its report changed (and "in their true tier" at 40 and 80 games, 67% → 68% and 69% → 71%, because Master, Grandmaster
and Champion, three tiers on the old scale, are now one Radiant 1 there without a place).

## The top two tiers

- **The rule** (`topTiers`, `topFloor`): Pearlescent at 2800 ladder points or more and among the 500 highest ladders;
  Transcendent the same among the 100 highest. The 2800 floor is the director's call: with few players the top 100
  would otherwise be everyone. Their RP count from the floor ("Transcendent · 120 RP").
- **Outside the top 500** at 2800 or more: Radiant 1, the RP counting on past 80 ("Radiant 1 · 95 RP"), as asked.
- **The place** is 1 + how many ladders are higher. **Ties share the better place** (my call, over "earlier to reach it
  ranks higher"): the same ladder is always the same tier, nobody is bumped down by a tie they can't see, and it needs
  no "when did they reach it" column (`last_at` is when the last game ended, which a game worth 0 points also moves).
  The cost: at the 500th or 100th place a tie can make the tier a few players larger.
- **The count** (`topPlace`, `packages/server/src/ranked-schema.ts`): only for a ladder at the floor or more (below it,
  no query at all), `SELECT COUNT(*) FROM ranked_1v1 WHERE ladder > ?`, answered from a new index
  `ranked_1v1_ladder (ladder)` (the plan, checked by a unit test: `SEARCH ranked_1v1 USING COVERING INDEX
  ranked_1v1_ladder (ladder>?)`): it reads only the index entries above that ladder, at most the players at 2800 or
  more, never the table. **Cached a minute per ladder** in each Worker instance (at most 2,000 ladders kept): equal
  ladders share a place, so one count serves everyone at that number. A place can be up to a minute stale.
- **The index** is the repo's usual migration: a `CREATE INDEX IF NOT EXISTS` in `RANKED_SCHEMA`, run once by
  `ensureSchema` when the schema's fingerprint changes. No column or row changes.
- **Where it's counted:** the profile (`rankedSummary`), the queue's read of a player (the versus screen's ranks), and
  a game's result: before the game counted before its write, after it once it's in (core's `rankedGame` can't know a
  place, so the server redoes the views with it).
- `apex` and its `from` points are gone; `apexStart` is now `divisionsEnd` (the divisions' 2800 points).
- **Not excluded:** a banned player's ladder still counts above others (as the profile's "Top N%" counts every rating);
  revisit if one ever sits in the top 500.

## Colors

Each tier's color is its emblem's main color, picked from the drawing's palette so its pill reads at 4.5:1 or better
on both themes (the RATING_RANKS test's formula; `ranked.test.ts`): Wood #dcaa66 (the walnut rim's light), Silver
#b9c3cf, Gold #f0b020, Paragon #56c682 (jade), Illustrious #86aeff (sapphire), Sublime #c096ff (amethyst), Radiant
#ff7e68 (ruby), Pearlescent #c8bed8 (pearl), Transcendent #ab90ff (starlight violet). The 1 v 1 pill now darkens its
ink in the light theme as RATING_RANKS' pills do (before, a light tier's pill was pale on white).

## The emblems in the game

- **Baked as the sidekicks are** (`scripts/bake-emblems.ts`, like `bake-sidekicks.ts`): one 22 KB picture and a table
  of cells; a unit test hashes every frame of the drawing against the picture, so it can't go stale. Nothing is drawn
  on a device.
- **Shown** by `RankEmblem`: a box of 48 × a whole step (1× or 2×), smoothing off, always its full size (with no
  emblem, in placements, it stays empty: nothing moves when a profile loads). The loops: a CSS `steps(8)` transform
  along their row (compositor only; no script, no repaint per frame); the first frame under reduced motion.
- **Where and how big:**
  - the versus stage: at each pawn's inner top corner, the two facing each other above "VS" (absolute, inside the
    pawn's box, so it lands with the pawn and moves nothing; the first try at the outer corners sat on the screen's
    edge, away from everything). 48 px on a phone, 96 on a computer;
  - the result card: your rank after the game beside its line (48), so a division or tier up shows the new emblem;
    its room is there from "Updating your rank…";
  - home's 1 v 1 panel (48, beside your rank); the profile's 1 V 1 section (96, beside the pill and the record);
  - the FAQ's ranks entry: each tier's division 5, Gold's five divisions, and the top two (48, a new `!emblems` line
    in the FAQ's text format);
  - **not** the in-game strips: the pill alone, to keep the board's room (the brief's list didn't name them).
- **Words that changed to fit:** home's panel line "Ranked chess vs one player near your level" is now "Chess vs one
  player near your level" (RANKED heads the row; the old line ran onto two lines beside the emblem at 320 px), and on a
  phone under 360 px the rank line is 13 px, so "Your rank: Transcendent · 1234 RP" stays one line.
- **Frame rate:** the town shows no rank, so nothing of the emblems is in its frame loop. The only looping emblems are
  Pearlescent's and Transcendent's, a compositor transform of 8 steps in 2 s.

## The admin switch

`?rank=<tier>-<division>` (`gold-3`, `wood-5`, `radiant-1`) or `?rank=pearlescent` / `?rank=transcendent`: that rank
(45 RP into a division; 120 RP over the floor for a top tier) in place of yours on your own screens: home, the stage,
your strip, the result, your profile (shown there even before a game). Only where `testSwitchesAllowed()`; read once as
the page opens, as `?bannerplus=`. Anything else is ignored; a player's is ignored.

## RATING_RANKS retired (Eric, Oct 28, later)

Eric: "get rid of the novice weighty … we're going with the new ranking system." The rank shown everywhere is the ranked
1 v 1 tier; the rating's own names (Novice … Weighty … Transcendent, `RATING_RANKS`, `ratingTier`, their pill effects
and their tests) are gone.

- **Home's line under your name:** your 1 v 1 rank, the tier and division in the tier's color, then the RP ("Gold 3 ·
  45 RP"); "Placement 2/5"; "Unranked" before your first ranked game; a blank line of the same height while your account
  loads (was "Weighty · 1580", "No rating yet"). The admin placeholder "Opal III" (`TEST_RANK`) is replaced by `?rank=`;
  `TEST_LEVEL` (the ring and "LVL 38") stays, and #400's place for the tag is unchanged.
- **The profile card:** their 1 v 1 rank's pill (once they've played a ranked game; your own shows `?rank=`), then
  "Rating 1612" (the crowd rating's number, no rank name; "No rating yet" as before), then "Top 18%". My call: "Top N%"
  stays, as it's the rating's percentile, not a rank name. The 1 V 1 section keeps the emblem at 2×. The rating chart is
  unchanged.
- **The server:** `PublicProfile.tier` is gone. An app still open from before the deploy reads no tier and shows "No
  rating yet" in that pill until it reloads (pre-launch, as other API changes).
- `rankOf` in the director's note: the old system's lookup is `ratingTier` (core), removed. The server's `rankOf`
  (ranked-schema.ts) is the new system's (a record's rank with its top-tier place) and stays.

## The public profile's numbers (Oct 28, later; additive)

`RankedSummary` (core's `ranked.ts`, shared by the server and the app), as `/api/me` and `/api/profile/:id` give it:

```ts
interface RankedSummary {
  rank: RankView;
  games: number; wins: number; losses: number; draws: number;
  peak: RankView | null;        // the highest ladder reached, as a rank (its top-tier place as it stands now); null in placements
  streak: number;               // the current run of ranked wins (a loss or a draw ends it)
  recent: RankedRecentGame[];   // the last 5 kept games, newest first
}
interface RankedRecentGame {
  at: number;                                                   // when it ended (ms)
  opponent: { id: string; name: string; look: ItemLook | null }; // "deleted", "Deleted account", null for a deleted account
  result: "win" | "loss" | "draw";
  points: number | null;                                        // null in placements, for a held side, and before Oct 28
}
```

- **Stored** (the repo's usual migration: `RANKED_COLUMNS`, each column added once; additive, nothing existing changes
  meaning): `ranked_1v1.peak` (filled once with each player's ladder then), `ranked_1v1.streak` (0), and
  `ranked_1v1_games.white_points` / `black_points` (null for older games). Written in the game's one batch:
  the peak only ever up, the streak +1 on a win and 0 on a loss or a draw (placements count; a held player's row isn't
  written, as before), each side's points (null in placements and for a held side). In the download, the guest merge,
  the pinned columns and the privacy policy ("the highest you've reached", "your current run of wins", "the rank points it
  moved for each player"; and that a profile shows these and the last five games to anyone, never the hidden rating).
- **Read** (`rankedSummary`): the row, the last 5 games (the existing white/black indexes), and the opponents' looks in one
  read (`looksOf`, locker.ts). A banned player's summary is null, as before. Games go after 30 days
  (`gamesKeepDays`), so `recent` holds at most the kept ones.

## Left alone

Home's `TEST_LEVEL` and its ring.
