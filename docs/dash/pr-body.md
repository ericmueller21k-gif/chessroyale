# Dash the cheetah: a new boss (admins first)

Round 1 of 3: **Dash** himself, in the game for admins first. His home and sneaker store (round 2) and his challenge intro
(round 3) aren't in; with no home, his challenge isn't offered. Decision: `docs/decisions/2026-11-03-dash.md`; tuning:
`reports/dash-sim.md`; his row: `docs/areas/bosses.md`.

**To turn him on for everyone:** take `"dash"` out of `BOSS_ADMIN_FIRST` in `packages/core/src/settings.ts` (one line, nothing
else changes; his FAQ block is written and shows once he's playable).

## What changed

- **Rules** (`packages/chess/src/bosses/dash.ts`, registered as every boss): **Clock Slap** (each capture of his, at the end of his
  turn, steals time from your clock), **Time Scramble** (the usual warning, then your next 5 moves get 3 seconds each), and **out of
  time is never a loss** against him (a move is played for you). Two new optional `BossRules` hooks, generic: `noTimeLoss`
  (`bossOutOfTime` false) and `outOfTime(boss, fen, allowed, ranked)` (the move played when nobody picked in time, in the runner's
  `resolveBoard`, which solo and the lobby share; the round marked `flag`, `JudgedMove.flag`). His clock is one function,
  `dashMoveClock`, behind the runner's `moveClock` (so `allowedMsFor`, solo's, the lobby's and the bots' deadlines all follow). He
  never thinks: `bossThinkMs` waits `dashThinkMs` (350 ms) for him, 1200 for every other boss.
- **Core:** his roster line (`dash`, "Dash", 🐆, offset −250, powers `clockslap` / `scramble`), his state (`DashState`), his events
  (`slap`, `scramble`, `flag`), his numbers in `BOSS_POWERS`, `"dash"` in `BOSS_ADMIN_FIRST`.
- **On screen** (`components/Dash.tsx`): **every moment of his plays where he stands** (a new optional `BossUi.inPlace`: his moments
  and the RAGE warning are `pm-stay` runs in his own figure, never a cast at the board's corner, so he never covers a square); the
  slap's moment (his clock slap, the time flying from your clock to him), TIME SCRAMBLE!, the big 3-2-1 over the board on every scrambled move (`ScrambleCount` in `Play.tsx`: the app's own
  `.cc-num` count in his orange, standing in for the move's "Round end" count), his flag's moment, **Tick** in the boss bar's prop
  slot with the time stolen or the scramble's moves left. Nothing new takes room; nothing moves.
- **Art** from `claude/boss-art`, copied as drawn with a source line each, keeping the art's names: `characters/boss-blitz.ts`
  (`BOSS_BLITZ`; its figure's name "Dash", its battle intro left out until round 3), `characters/sidekicks/sidekick-blitz.ts`
  (`sidekickBlitz`, named "Tick"), `components/tokens/token-blitz.ts` (`TOKEN_BLITZ`, wired as Timber's: `TOKEN_ART.dash`). His
  figure in a frame 33 px wider on the right (`dash-figure.ts`: the zip-in starts past the art's frame on purpose).
- **Sounds** (`characters/dash-sounds.ts`, 19, synthesized): sneaker squeaks, his zip-in, a snap, whooshes, the clock's click, tick,
  tick-tock, slam, whirr and flag, your time ticking away as he steals it, his "yeah!", "oof", yawn and slump; Tick's ding, chomp and
  step. Each about 4 dB under a move's mean loudness, peaks under half a move's. His select sound: a sneaker squeak, a slap of the
  clock and his "yeah!" (`dashHello`).
- **Lines** (`characters/dash-lines.ts`): the director's draft merged with the art session's; listed below.
- **Names:** every word a player sees says Dash. No stored id used `blitz` (tokens are keyed by boss id; the ride is
  `cheetah-shoes`): nothing mapped. Cheetah Shoes' description now says "Dash says…" (its cells' hash re-measured:
  `town/ride-cells.ts`); `components/tokens/index.ts`'s comments. The Blitz time control in Duel and 1 v 1 is untouched.
- **Sim** (`packages/sim/scripts/boss-sim.ts`): a player's clock and time model for Dash (below). **Docs:** the decision note, his
  row, the new hooks and "A power on your time" on `docs/areas/bosses.md`, his FAQ block (`BOSS_BLOCKS.dash`).
- **CI:** `e2e/areas.json` maps his paths to `e2e/dash.spec.ts` and the smoke test.

## Your time against him (the calls; Eric wanted few questions)

- **"Your time" is the clock you already have** (the dock's, at the right of the box under the board, every boss screen, phone and
  computer): the **bank** in Boss alone and a Boss Battle party (10 + 10; the party's one team bank), the **move timer** in the Solo
  raid and a Boss raid (20 s).
- **A slap steals** 30 s off the bank, or makes a raid's next move 6 s shorter (never under 8 s; one slap a move). A slap that would
  take nothing (an empty bank, a scrambled move next) doesn't come.
- **The scramble** caps 5 moves at 3 s each; on a bank they still come out of it with its increment.
- **Out of time** (a scrambled move's 3 s, or an empty bank): **never a loss.** A move is played for you **at random from the
  judge's top 4** (seeded, the same everywhere), with his jab; the bank can sit at 0 and each move then has its 10 s. In a raid only
  when nobody picked in time. Why the top 4 and not any legal move: in the sim a random legal move hung a piece more often than not
  and decided the battle (one a battle took the crowd from 0.25 to 0.03).
- **The same in all four modes:** it all lives in the runner's clock and `resolveBoard`, shared by solo and the lobby.
- **Fair play: a raid's scramble is enforced by the server.** The lobby sets each human's deadline from the runner's `allowedMsFor`,
  which reads `dashMoveClock`: a scrambled move's deadline is 3 s from its start, a slapped move's timer is shorter, and the bank is
  the server's; `pick()` refuses a pick after the deadline and its grace, as any late pick. The flag's move is the server's
  (`resolveBoard`, from the host's evaluation and the battle's seed). Tested in `packages/server/test/dash-lobby.test.ts`.
- **No `powerTurn`:** nothing on the board changes, so fair play counts every turn and the God King's Last Stand works as ever.

## The sim (reports/dash-sim.md)

The raid sim (the raid's 50 bots, the boss at tier 1600 − 250) with a **player's clock** (Boss alone's bank, his slaps taking from
it) and a time model (a move's time log-normal, median 10 s; a scrambled move's median 2.2 s, so about one in five runs past 3 s; a
move run out is nobody's pick and his rules play the flag's move).

| Run | What | Battles | Crowd score | Scrambles a battle | Moves run out a battle | Slaps (time) |
|---|---|---|---|---|---|---|
| Z | no scramble, slaps only | 12 | 0.25 (± 0.10) | 0 | 0 | 10.8 (5:22) |
| A | `rageSpeed` 1, any legal move | 24 | 0.04 (± 0.04) | 1.71 | 1.75 | 10.0 (5:00) |
| B | 0.5, any legal move | 20 | 0.05 (± 0.05) | 1.05 | 0.90 | 10.4 (5:14) |
| C | 0.35, any legal move | 20 | 0.03 (± 0.02) | 0.65 | 0.65 | 11.1 (5:33) |
| **D** | **1, top 4 (shipped)** | 20 | **0.15 (± 0.07)** | 1.90 | 1.20 | 10.2 (5:06) |
| E | 0.7, top 4 | 20 | 0.23 (± 0.08) | 1.45 | 1.15 | 10.8 (5:22) |

**Shipped: offset −250, `rageSpeed` 1, `flagTop` 4, 30 s a slap: the crowd scores 0.15 in 46 moves**, with the roster (Babur 0.12,
Puddles 0.17, Timber 0.18, Moo 0.21). No player's bank ran out in any run (lowest 2:39, mean lowest 4:45): the slap is pressure, the
scramble the threat.

## Frame rate (eric.md's method)

Headless, Boss alone on your move, 2.6 s (a scrambled move's 3 s: Dash with the 3-2-1 over the board and Tick rattling, against Folio
on an ordinary move), the medians of four runs taken in turn, a phone 390 × 844 and a computer 1440 × 900:

| | Dash (scrambled move) | Folio |
|---|---|---|
| Phone: fps (worst frame) | 60.0 (17 ms) | 60.0 (17 ms) |
| Computer: fps (worst frame) | 60.0 (17 ms) | 60.0 (17 ms) |

Two of Dash's eight runs had one long frame (33 ms on the phone, 50 ms on the computer; Folio's none); the first measurement had one
of 67 ms on the computer, after which the count lost its blurred text shadow and its pop is composited. Nothing runs per frame: the
count is drawn again as its second changes (a timer), the slap's flight is placed once and then CSS, Tick is a still with CSS.

## Every player-visible text

- Name **Dash**; tile color violet; icon 🐆; Tick's tally `−0:30` / `3s × 4`; aria "Dash has stolen 0:30" / "Time Scramble: 4 moves
  left"; the count's aria "3 seconds left. Time Scramble: 4 of 5 moves left".
- Boss menu words: "steals your time when he takes a piece, Clock Slap · Time Scramble".
- Warning banner: "RAGE!" / "Next turn: Time Scramble". Banner: **TIME SCRAMBLE!** / "Your next 5 moves: 3 seconds each".
- The slap's flight: "−30s" (a raid: "−6s"). Dock: "He stole time off your clock"; "Out of time: a random move was played for you".
- Cheetah Shoes: "Spotted, laced and twice as fast. Dash says the spots are just for show; the speed is not."
- FAQ (shows once he's playable): "Plays from the game so far. A lanky, cocky cheetah in a backwards orange cap and a teal and orange
  track jacket, a chess clock under his arm, his tortoise Tick asleep on the clock in his bar. He never stops to think: his moves come
  at once. His powers are why he plays 250 under the usual strength. / Your time is the clock at the right of the box under the
  board: alone or in a party it's your time bank for the battle (the team's one bank in a party); in a raid it's each move's timer.
  / **Clock Slap** (passive): every time he takes one of your pieces he slaps his clock and steals your time: 30 seconds off your bank,
  or in a raid your next move's timer 6 seconds shorter (never under 8 seconds). Tick, in his bar, keeps count of what he's stolen. /
  **Time Scramble** (ultimate): after the warning, your next 5 moves get 3 seconds each, counted down over the board. They still come
  out of your bank, which still gets its extra seconds. / **Out of time** against him is never a loss: a move is played for you instead, picked at random from the four best moves (in a raid, only if nobody picked in time). Your bank can run down to nothing; each move then has just its extra
  seconds."

### His lines (every one)

- **Entrance** (and the select): "Yo yo yo! Dash in the building, fam!" · "Sup, cuz. Ready to get cooked?" · "Bet. Let's run it,
  broski."
- **Thinking** (he never thinks): "Bro, I already know my move. No cap." · "Clock's ticking, fam. Tick tock, my guy." · "Yo, where'd
  you cop those kicks, broski?"
- **His move:** "Speed, baby." · "Too easy, fam." · "Ayo, what size are those? Asking for a friend."
- **Capture:** "That piece? Chopped. Fully chopped." · "Sheesh!"
- **Clock Slap:** "Yoink! That time's mine now, cuz." · "Sheesh! Clock slap, baby!" · "W in the chat. W on my clock."
- **Check:** "Check, broski. It's giving… checkmate." · "Check! That's bussin. Is that the word? That's the word."
- **Hurt:** "Yo, that's lowkey rude." · "Okay, okay. W for you, fam. Small W."
- **Strike** (a raid): "Yoink!" · "Too slow, cuz!"
- **Smug:** "This game is chopped, bro. Chopped." · "Am I the main character? Kinda, yeah." · "Real quick: you wanna try these on?"
- **Rattled:** "Bro, I'm not sweating. It's just humid." · "Deadass did not see that coming."
- **Scramble warning:** "Speed run, broski! Let's gooo!" · "Lace up, fam. This is gonna be quick."
- **Time Scramble:** "Three seconds a move, cuz. Skrrt!" · "Tick tock, my guy. Tick tock."
- **Your time ran out:** "Too slow, cuz! I picked one for you." · "No cap, you need Cheetahs." · "Bro moved like he's in flip-flops."
- **Victory:** "Too fast, fam! Built different!" · "W! Big W! Hashtag no cap." · "W in the chat. Shoes are 20% off, broski."
- **Defeat:** "GG, cuz. Lowkey you're goated." · "I'm cooked. Bro, I'm so cooked."

## Visuals (docs/dash/)

`dash.gif` (phone 390 × 844, 5.6 MB: the intro, a Clock Slap in his bar with the time flying to him, TIME SCRAMBLE!, the 3-2-1, a move run out
played for you and his jab, the next scrambled move); stills, phone and computer (1280 × 800): `*-select.png` (his tile, an admin's),
`*-slap-flight.png` (the time on its way to him), `*-slap.png` (his line typed out in full), `*-scramble-banner.png`, `*-countdown.png`, `phone-after-flag.png`.

- Director, on review: the FAQ's out-of-time sentence said "a random legal move"; it now says what the rules do ("picked at random
  from the four best moves", from `flagTop`).

## Checks changed (old → new)

None removed or loosened; none guards a rule in `docs/rules/eric.md`.
- `packages/app/test/banners.test.ts`: the bosses' screen files it reads, + `DASH_UI` (TIME SCRAMBLE!'s banner checked as every one).
- `packages/app/test/boss-bar-same.test.ts`: the bosses it checks, playable ones + Dash (admins first; every moment of his plays in
  this figure, so every frame must fit the bar's room as any playable boss's).
- `packages/chess/test/king-save-altered.test.ts`: `AUDIT` + `dash` ("his powers change no square and limit no move").
- `e2e/boss-smoke.spec.ts`: `PASSIVE_EVENTS` + `clockslap: ["slap"]`.
- `packages/app/src/town/ride-cells.ts`: Cheetah Shoes' hash (its file's text changed), checked by `town-rides.test.ts` as before.
- New: `packages/chess/test/dash.test.ts`, `packages/server/test/dash-lobby.test.ts`, `packages/app/test/dash-wired.test.ts`,
  `e2e/dash.spec.ts`.

## Ran locally

Typecheck (all packages); vitest: `dash.test.ts`, `dash-lobby.test.ts`, `dash-wired.test.ts`, the boss kit for Dash
(`boss-kit.test.ts -t dash`) and its parity (`boss-kit-parity.test.ts -t dash`), `characters`, `boss-kits`, `boss-select`, `faq`,
`banners`, `power-words`, `boss-character`, `boss-bar-same`, `boss-difficulty`, `maia-players`, `recluse` (app and chess),
`timber-sounds`, `king-attack`, `speech`, `town-rides`, core `boss` and `crates`, server `boss-tokens` and `test-switches`,
`king-save-altered`, `timber`: all pass. e2e under the lock: `e2e/dash.spec.ts` phone and desktop (5 passed, 1 skipped by design),
`boss-smoke.spec.ts -g Dash` on the phone: pass. After the director's review (his slap cast at the board's corner covered squares): every moment in place, re-run
`dash.spec.ts` (now also: his figure never at the corner, never hidden, its box never over the board) and the smoke test: pass.

## Lane

**Boss lane**, and it touches rules shared by every boss (the runner's `moveClock` and `resolveBoard`, two new `BossRules` hooks,
a raid's deadlines): CI should run with the **`full-e2e`** label, and the boss lane's one quick review pass by a fresh helper.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
