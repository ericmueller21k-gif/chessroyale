# Chandy's rules: the locks, the rifle's upgrades, his five moves and Dodge (Eric, Nov 15-16). Opus, xhigh, alone

Effort xhigh (rules, boss brain steering, a crowd mini-game, online sync: a bug here breaks a match). You are the `god-king` delegate
(bosses' powers; ask nothing of the `engine` lane except through `docs/areas/engine.md`'s interfaces). Boss lane: targeted + the boss
kit + one quick review by a fresh helper (the director starts it). New branch `claude/chandy-rules` from main. Include
`notes/briefs/rules-common.md`. Read `.claude/LESSONS.md`, CLAUDE.md, `docs/areas/bosses.md` ("The ground rules of every power", "The
rage meter", "Adding a boss", the boss table), `docs/rules/eric.md`.

## The spec (Eric approved; don't redesign it)
- **`DESIGN.md` on branch `stills/boss-chandy`** (rounds 1, 2, 2b, 2c): every question with its answer. Where Eric answered, his answer;
  elsewhere the recommended answer (A) stands. Eric's later notes, also binding: no aim lines during Dodge's vote (players read where
  each gator stands and points); the lines flash only after the lock; clones visible while firing; blasts the full rank/file.
- **`docs/ideas/chandy-wiring.md`** on main: how the art (#736, merged) plugs in, plus the review's notes (device time via
  `local(serverTime)`, the teleport schedules as settings with the "last one 1.2 s before the close" test, `@perf` on the scope-in).
- In short: **locks** (L1-L6: the first lock right before a capture; then hunt 3 of his turns, live at most 5; up to 2 staggered; never
  the king or queen; the engine steered within the margins of L3; only capturing a locked piece upgrades); **upgrades** (5, the parts
  in a fixed order, each unlocking a random move; the 2 s window, clock held); **the move meter** (from the first upgrade, full every 6
  crowd moves; random among unlocked, a new unlock first); **scatter** (Boingo's pie squares), **beam** (a rank and file, never the
  king's: walls for your turn, the squares hidden; covered pieces still block, defend, check), **shields** (two of his pieces you
  attack, never one giving check; Don Dough's gold rule for every piece, one turn), **rapid fire** (Moo's stun on three, dizzy),
  **queen lock** (his side only, only when a pawn/knight/bishop can be put between; your move is free; he fires at the start of his
  next turn; the first piece of yours in the way shatters; nothing in the way, she dies; your king stops it); **Dodge** (his ultimate:
  the rage meter dimmed until 5 upgrades; at most 2 a battle; the scope-in, the king to e4/e5 on a blank board, 3 rounds, gators on
  the edge squares teleporting 1/2/3 times, the crowd votes the king's square with 3 s plus 300 ms grace, no votes = a random square
  from the seed, one hit loses the battle for everyone, the God King's Last Stand doesn't apply; the board comes back as it was).
- Every choice from the battle's seed and the position, the same solo and online (the server decides; the boss kit's parity test).
- The ground rules: a power never leaves the crowd without a legal move (it lifts that turn instead); the clock stands still through
  every moment; a turn a power touches doesn't count for fair play; a refused tap says why in the dock.

## Also
- **His theme** (Eric approved): `stills/trailer-v2` commit 0515eb79, `boss-music-stereo-192/chandy-loop.mp3` / `.ogg` and the
  `chandy` entry of that folder's `themes.json` (loop 155.844146 s, intro 0, pad 0.5, bpm 154, -16.8 LUFS, -1.1 dBFS). Copy them in
  as #733 did for Babur's (`packages/app/public/music/`, `themes.json`).
- **Into the roster, admins first:** `BOSS_ROSTER` with his powers; `BOSS_ADMIN_FIRST` keeps him to admins; his kit moves from
  `ART_KITS` to `BOSS_KITS` (watch the side figure's size test #736 noted: his wide frame must not shrink every boss's side figure);
  his God King swing (`kingAttack`) stays on the deck (the swamp PR #737 fixed `drawAttack` for a lifted boss: merge main once #737
  is in). His home's "Coming soon" lifts once he's playable (`bossReady`).
- **Lines:** placeholders where none exist (his challenge line, power banners' words), short, marked for Eric; American English.
- **Strength and tuning:** one sim run at one setting (boss lane): his strength offset so the crowd's score lands inside the pack, and
  the lock numbers so 5 upgrades come in at least 9 battles in 10 (report the share). All tunables in `settings.ts`.

## Tests (boss lane: no fuzz marathons, no mutation runs)
His rule tests (`packages/chess/test/chandy.test.ts`: each power's picks and guards, the lock rules, the queen lock's pre-check and
shot, Dodge's one-safe-square proof for every safe square and teleport, the vote's tally and random fallback); the boss kit
(`boss-kit.test.ts`, `boss-kit-parity.test.ts`) passing with him on the roster; app tests for his moments; `e2e/chandy.spec.ts` (each
power shows; Dodge plays a round with a vote; a hit ends the battle) and `boss-smoke` with him; his paths in `e2e/areas.json`;
`@perf` on Dodge's scope-in and a power. Watch it frame by frame with real taps (`npm run frames:boss`).

## Deliver
Update `docs/areas/bosses.md` (his row and his section), a decision note in `docs/decisions/`, `.pr-body.md` (what changed, player-
visible, the sim's numbers, checks old -> new), then `.done`. Push work in progress at each real step. No PRs, no CI waits, no
images under docs/, no model names in commits (end with the Claude-Session line only). If a rule in the spec turns out unbuildable or
unfair once coded, stop and write `.question` (one line each, with your recommendation) and wait in one foreground Bash call for a
`.answer` from the director (`timeout 590 bash -c 'until git fetch -q origin claude/chandy-rules && git show origin/claude/chandy-rules:.answer >/dev/null 2>&1; do sleep 30; done'`).
