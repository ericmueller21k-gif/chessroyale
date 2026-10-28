# Folio on a computer: its banners' portraits in view; every boss clear of the board (Oct 28, 2026)

Lane: `characters` (the director's own small fix). Area page: [bosses.md](../areas/bosses.md). Follows
[2026-10-27-folio-wired.md](2026-10-27-folio-wired.md).

## What Eric saw (Oct 28, on a computer)

Three screenshots of a Boss alone battle against Folio: "the banner is off" (CREASE!: Folio's portrait cut off at the board's
left edge, the God King's at its right), "look at his bishop he crossed over when it was folded?" (its bishop crossed the
crease's line), and "hes behind the board when idling" (its wing tip under the board's left edge).

## What it is now

- **Power banners: a long line under the word wraps to two** (`.fight-banner.power-cut .fb-sub`: at most 46 % of the board
  wide, the two lines balanced). A banner's band is a centered row (the boss's portrait, the words, the God King's portrait)
  wider than the board and clipped to it; Folio's lines ("Your pieces can't cross it for 4 turns", "End the attack in 2
  moves, or it folds") on one line made the words so wide that both portraits sat past the board's edges. Every boss's power
  banner gets the same rule, so the longer lines of others ("No crossing the middle for 4 turns", "Two duels: you must take
  one") stop pushing their portraits too; a line that fits stays on one. The words are unchanged. Phone and computer: it's the
  same banner, sized by the board.
- **With no eval bar, the boss beside the board stands 24 px further out** (`--bs-out` on the game screen, added to
  `.boss-char.place-side`'s `right` and to the window's room for him, `--bs-reach`). The bosses' places were set with the eval
  bar showing, as testers see it (18 px and its gap, 24 px); a player has no eval bar and the board takes its room, so every
  boss stood 24 px nearer the board than he was placed: the wide ones' drawings went under the board (Wrangler 14 px,
  Hollow 12, Sawyer, Smudgy and Jefferson 6 to 10, Folio about 20 before this change), the rest just touched it. Now a
  player sees each boss as far from the board as a tester does.
- **Folio stands 6 sprite px further out than its feet would put it** (`.boss-char.place-side.ch-folio`, `--bc-shift`): its
  frame is 97 px wide with its feet at 52, so its wing reaches 45 sprite px toward the board, the most of any boss. Its head
  then reaches 58 sprite px out, 14 past Sawyer's 44 that the window's room was sized for, so `--bs-head` adds those 14
  (28 screen px at 2x) to `--bs-reach` while Folio is the boss; the board gives up width only when the window's margin
  can't hold that.

## The calls I made

- **The Crease letting Folio's own pieces cross is the rule, not a bug.** Its rules (docs/decisions/2026-10-27-folio-rules.md,
  approved by Eric): the crease stops the crowd's pieces only; Folio folds the board toward itself, so its pieces cross it
  (Sawyer's Board saw stops both sides; this is the one difference between them). The banner says so: "Your pieces can't
  cross it". Nothing changed; told Eric.
- **Wrap, not shorter words.** Shorter lines would fix Folio's banners only; the wrap keeps every power banner's portraits in
  view, whatever a line's length.
- **Fix the cause for every boss, not Folio alone.** Eric saw Folio; measuring every boss's drawn pixels against the board
  (below) showed five others under it too, all by the eval bar's width.

## Measured

Each boss's idle beside the board in a local Boss alone battle: the board's left edge less the rightmost drawn pixel over
2 s (positive: clear of the board), eval bar off (a player) and on (a tester).

| Window | Before, no eval bar | After, no eval bar | After, eval bar |
| --- | --- | --- | --- |
| 1280 × 800 | Folio −20, Wrangler −14, Sawyer −10, Smudgy −10, Hollow −12, Jefferson −10, Alfil and Chub & Chirp 0, the rest 2 to 16 | all 10 to 44 (Folio 16) | all 10 to 44 (Folio 16) |
| 1536 × 864 | the same as at 1280 | all 10 to 44 (Folio 16) | all 10 to 44 (Folio 16) |
| 1024 × 768 (drawn at 1×) | (eval bar on, before: 9 to 29) | all 9 to 29 (Folio 15) | all 9 to 29 |

The board's box is the same before and after at 1280 × 800 (384 + 504 px with no eval bar) and 1536 × 864 (476 + 576). At
1024 × 768 the window's margin is tight: with Folio or the Hidden Boss and no eval bar the board is 436 px instead of 464,
as it already is with Babur (his pump), so they have room; every other boss keeps 464.

## Tests

- `e2e/boss-side.spec.ts` (computer): Folio, Wrangler, Hollow, Sawyer, Smudgy and Jefferson, eval bar off, each idle's
  rightmost drawn pixel over 2 s stops short of the board.
