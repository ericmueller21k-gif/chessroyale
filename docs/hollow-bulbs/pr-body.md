# Hollow: ten bulbs in Boss alone, his bigger darkness and his taunts (Eric, Nov 5)

**Lane: full e2e** (a rules change: add the `full-e2e` label). Decision: `docs/decisions/2026-11-05-hollow-bulbs.md`.

## What changed

- **Boss alone against Hollow: ten bulbs instead of points.** Each wrong move into the dark puts one out (no −5, no 5-a-turn
  cutoff). At the 3rd and 7th the dark plays that turn's move for you, a bad one (15 to 30 points against the best; never a
  move that lets him force mate, nor one that mates or stalemates). At the 10th the screen goes black, he speaks, and you
  lose. Decided by the shared rules (`hollowBattle.darkTry`, `darkForcedMoveFrom`, the runner), shown by the screen.
  Versioned: a battle keeps the rule set it began with (`hv`, `strand`).
- **Crowds, raids and parties keep today's points** (Eric: "bulbs only apply in solo for now to avoid a griever spamming bad
  moves"): −5 a wrong try, the 5th a missed move.
- **Deeper dark, everywhere he plays:** a 2 x 2 block after his 6th, 12th and 18th moves (4 turns); his 3 x 3 once a game after
  his 9th (2 turns). Never on a king's square; holds pieces when it can; overlapping squares stay dark until the later end.
- **His taunt on every wrong move into the dark**, alone and in a crowd, at random, never the same twice running.
- New sounds: a bulb going out (`hollowFizz`), the dark's move (`hollowForced`); the blackout reuses his `hollowBlackout`.
- Test switches: `?bulbs=N` (N out as the battle begins), `?darkblock=2|3` (that block with his first cover).
- The boss sim gains Boss alone and a player in the dark (`alone`, `bulbs`, `darkMiss`).

## Player-visible changes and text

- Boss alone vs Hollow: his strand of ten bulbs in the boss bar's free room under the status (his lights' colors), one lit per
  wrong move left; a bulb going out flickers and fizzes.
- Dock, after a wrong move alone: "Your move. Bulb out · 9 left" (was "−5 · 4 tries left"); no "−5" over the square alone (the
  slash stays). In a crowd unchanged: "−5 · 4 tries left".
- His taunts (in his speech bubble): "Nice try.", "What, can't play in the dark?", "Something was there. Wasn't it?", "You
  reached for nothing.", "Feeling around, are we?", "The dark remembers. You don't.", "Not there. Never there.", "Wrong. And
  it's getting darker." (Placeholders but Eric's two, until Eric's lines.)
- The 3rd and 7th bulb: a dark flash over the board; his line "The dark moves for you."; the dock's line "The dark moves for
  you."; the move plays as yours.
- The 10th: the screen fades to black; ten dark bulbs; "HOLLOW / Lights out. Forever."; "Your last bulb went out."; then the
  loss screen: "Defeated", "Hollow won: the last of your ten bulbs went out."
- His blocks' banners: "DEEPER DARK!" / "2×2 dark for 4 turns"; "PITCH BLACK!" / "3×3 dark for 2 turns".
- FAQ (Hollow): the dark adds "Each wrong move gets a dry word from him."; new entries "Your 10 bulbs (Boss alone)" and
  "Deeper Dark (passive)".

Stills (`docs/hollow-bulbs/`): `bulbs-taunt-phone.png`, `bulbs-taunt-desktop.png` (the strand, a bulb out, a taunt),
`bulbs-forced-phone.png` (the dark's move), `bulbs-block2-phone.png` (a 2 x 2), `bulbs-block3-banner-phone.png` and
`bulbs-block3-desktop.png` (the 3 x 3), `bulbs-blackout-phone.png`, `bulbs-result-phone.png`.

## Changed checks (old → new)

- `packages/chess/test/hollow.test.ts`, "in a battle: each dark square lasts 10 crowd turns…" → "…lasts as long as the longest
  cover over it (10 turns for a single square, 4 for a 2 x 2 block, 2 for the 3 x 3)…"; "about 4 at once" → 4 single squares
  plus the blocks' squares.
- `e2e/hollow.spec.ts`, "Hollow's dark: … a wrong attempt (-5), … the 5-try cutoff" (Boss alone) → "Hollow's dark, Boss alone: …
  his ten bulbs, a wrong attempt (a bulb out and a taunt), … the dark's move at the 3rd bulb": "−5" and "4 tries left" → "Bulb
  out · 9 left", no "−5", the strand 10 → 9; roundScore −5 → 0; "5 wrong tries end the turn as a miss (−25)" → "the 3rd bulb:
  the dark moves for you". The crowd's −5 and 5th-try miss stay checked (the online test; `hollow-bulbs.test.ts`).
- `e2e/hollow.spec.ts`, "Hollow online: …": added a taunt in his bubble and no bulbs online (checks added, none removed).
- `packages/chess/test/boss-kit-lib.ts`: `KNOWN_STEPS` + `darkForcedDue`.
- `e2e/hollow.spec.ts`, the Boss alone dark test: the strand's on-screen check now also requires it inside the bar's prop slot
  (added). `e2e/boss-bar.spec.ts` is unchanged: the strand no longer moves the computer's slot (CI's red on #500).
- None guarded a rule in `docs/rules/eric.md`. Eric's three new rules are added there with their guards.

New: `e2e/hollow.spec.ts`, "Hollow's taunts and \"The dark moves for you.\" show whole in his bubble, typed out: nothing clipped (a
phone 390 wide, a computer 1440)" (each line said, typed out, its text's scroll size within its box and every row inside it;
the director's review: the first taunt still had been taken mid-typing, "Wrong. And it's", its second row still to type; every
line fits). `packages/chess/test/hollow-bulbs.test.ts`, `packages/app/test/hollow-bulbs.test.ts`, and in `e2e/hollow.spec.ts` "Hollow's
bulbs (Boss alone): a 2 x 2 block of the dark drawn, then the 10th bulb out: total darkness, his line, the loss" (phone and
computer).

## Sims (old → new; `reports/boss-sim/raid-hb*.jsonl`)

- Crowd (Solo raid, 50 bots, 13 battles each): 0.15 ± 0.09 → 0.08 ± 0.05 for the crowd, 47 → 44 crowd moves; inside the
  roster's band (about 0.08 to 0.55); noise (bots never try the dark, so the blocks can't move them).
- Boss alone (one bot, a player in the dark at 30%, 26 battles at Medium): 0.00 → 0.00 (one sim bot loses every battle, even at
  Very easy, bulbs on or off); wrong tries 1.6 → 2.9 a battle (the blocks), 16 forced moves (0.6 a battle), 0 blackouts in 52
  battles, the most bulbs out 9.

Tested locally: typecheck; the unit tests of chess, core, server and app (one app test, `duel.test.ts`'s result card, times out
on this loaded machine on main too); `e2e/hollow.spec.ts` Boss alone (phone and computer) and online (computer).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
