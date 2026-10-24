# Banners and speech: longer, one rule everywhere, and a URL to try the lengths (Oct 24, 2026)

Lane: targeted, bordering full: shared timing the server and the solo game both read (`packages/core`, `boss-timing.ts`),
no protocol change, no stored data. Online play keeps the server's default, so nothing can desync.

## What Eric asked (Oct 24, testing on his phone)

"we need the banners to appear… at least… 3/4 of a second longer, or 1/2 a second even, just to start… across the entire
board… I want to be able to just… have a URL where I can change the URL and make it say 1/2 a second longer or 1 second
longer or 3/4 of a second longer, and then I can go test all three of them… the large banners… when the boss ults, when
your queen is down, for any mode, those things should be more consistent, because it's just so fast."

"same with the text bubbles when the boss talks… I couldn't even see what the heck he was saying… because it was so
fast. And it shouldn't linger forever… there's just something wrong with the timing firing on these things… they need
to be like a second longer if they're like two rows or more than a certain number of words, and then even… sit out a
little bit longer."

## 1. Every banner longer, the same length, nothing under it

**The trap** (docs/decisions/2026-10-16-banner-timing.md): on Oct 15 every banner got a second longer but the beats after
them didn't move, so powers played under their banners. So a longer banner must push back everything after it.

**The setting.** `BANNER_PLUS_MS` (750) in settings.ts, read through `bannerPlusMs()`. Every boss banner is now one
length, `bossBannerMs()` = `BOSS_BANNER.ms` (1.5 s) + the extra = 2.25 s. A banner that used to end early because its
power started early (Leapfrog's 0.72 s, the Carrot Patch's 1.1 s, the 1.25 to 1.45 s ones) is brought up to that length,
and its power now waits for it. (My call: "any banner shorter than a boss's" covers those too. Eric asked for "more
consistent".)

**One place adds the time.** Each power's view keeps its Oct 16 beats and its window (`banner(text, sub, tone, until,
from)`). `POWER_BANNERS` in `boss-timing.ts` lists those windows as `[from, window]` for each moment kind, so the server
and the runner know them. A unit test keeps the list equal to what every view draws.
- A banner from the moment's start makes the moment's own clock wait at its start (`bannerLeadMs`). `momentsOf` gives the
  moment a `lead` and moves its `at` back by it. `PowerMoment` draws the banner from the start of the lead and draws the
  view as at its first frame until then. Everything keyed to `moment.at` (the power, the boss's cast, his line, the board
  layer's squares, the sounds, Big Boy's bounce position) comes that much later, and no boss's own file changed.
  (`Boss.tsx` counts the lead as part of the bounce, so the board keeps the position before the bounce while the banner
  is up.)
- A banner later in its moment (the Hidden Boss's BULLET!, Wrangler's DRAW!) grows in place. The moment gets longer by
  however much of the banner runs past its end. BULLET! still fits inside its moment, so its moment doesn't change.
- `powerFxMs` adds both (`bannerWaitMs`). So the solo runner's and the lobby's holds (`powerMomentMs`, `bossTurnShowMs`,
  the own-screen holds for the funhouse, bounce, extra move, hop, tusks and slam) wait for it, solo and online, from the
  same numbers.

**Every banner found, before → after (s on screen, default extra):**

| Banner | Before (Oct 16) | After | What moved later with it |
| --- | --- | --- | --- |
| RAGE! (every boss's warning; Babur's hoops warning too) | 1.5 | 2.25 | the moment's end, the crowd's clock |
| FREEZE! | 1.5 | 2.25 | the bolt, the ice |
| BLIZZARD! | 1.3 | 2.25 | the sweep |
| THAWING! / THAWED! | 1.3 | 2.25 | the melt |
| PIE! | 1.45 | 2.25 | the throw |
| FUNHOUSE! | 1.5 | 2.25 | the clown, the turn, the move |
| SPIN! / BACK AGAIN! | 1.3 | 2.25 | the turn |
| SPARKLER! | 1.45 | 2.25 | the throw |
| ROMAN CANDLE! | 1.5 | 2.25 | the drop and the shots |
| DARKNESS! | 1.25 | 2.25 | the pour |
| TWICE! (Hollow's extra move) | 1.5 | 2.25 | the move |
| LIGHTS OUT! | 1.3 | 2.25 | his drop and every round (`LIGHTS_OUT.dropAt`) |
| TOY BLOCK! | 1.45 | 2.25 | the throw |
| BIG BOUNCE! | 1.3 | 2.25 | the leap |
| SPLIT PAWN! | 1.3 | 2.25 | the hop and the saw |
| SAW CUT! | 1.5 | 2.25 | the cut |
| BOARD SAW! | 1.5 | 2.25 | the rev and the run |
| LONG PULL! / LASSO! | 1.3 | 2.25 | the throw and the tug |
| SHOWDOWN! | 1.3 | 2.25 | the drop, the line-up |
| DRAW! | 1.4 | 2.25 | the moment's end |
| BULLET! | 1.5 | 2.25 | nothing: it fits in its moment, before the bullet clock |
| TUSKS! | 1.5 | 2.25 | the cast |
| MAMMOTH SLAM! | 1.5 | 2.25 | the leap |
| LEAPFROG! | 0.72 | 2.25 | the hop |
| CARROT PATCH! | 1.1 | 2.25 | the tosses |
| FIVE CARROTS! | 1.5 | 2.25 | the cheer, the attack at a mate |
| CAMOUFLAGE! | 1.5 | 2.25 | the splash |
| REPAINT! | 1.5 | 2.25 | the strokes |
| START! | 1.5 | 2.25 | the first move's clock (`BOSS_INTRO.bannerMs`) |
| QUEEN SLAIN! | 1.5 | 2.25 | the boss's move (`bossThinkMs`: 2.75 s) |
| QUEEN DOWN! | 1.5 | 2.25 | your turn (`bossShowMs`: 3.85 s, was 3.1) |
| PHASE 2 | 1.4 | 2.15 | the countdown and phase 2's clocks |
| 5 SECONDS! | 1.5 | 2.25 | everyone's few seconds (`phase2Ult`: they start as it goes) |
| The God King's cut-in | 2.5 | 3.25 | his bolt, slashes, lowering (`KING_COMMAND`), `moveMs`, `kingStrikeMs` |
| The Last Stand's cut-in | 3.1 | 3.85 | the slide, the blows, the stagger, the fall, `lastStandMs()` |
| FISCHER RANDOM! (crates) | 2.5 | 3.25 | the second spin |
| Squads' block banner | 3.6 | 4.35 | nothing (drawn only, never held the game) |
| Auto chess's ACTION / MOVE / BATTLE PHASE | 1.6 | 2.35 | nothing (the step's clock runs under it, as before) |
| The votes' result (Crowd, Squads) | 4.2 | 4.95 | the next vote or the match (`voteResultMs`) |

Not changed: `KING_SUMMON` (the old summon-onto-the-board style, off behind `kingOnBoard`: whoever turns it on adds the
extra as `KING_COMMAND` has); the Hidden Boss's in-place animations during BULLET! (beside the board, not under it).
Babur's hoops cast has no banner of its own (only the warning before it), so it is unchanged.

**My calls.**
- **5 SECONDS!**: since Oct 14 everyone's fresh 5 s ran under it. A 2.25 s banner over every board would take almost half
  of them. `phase2Ult` now starts the few seconds as the banner goes (`turnAt` = now + `bossBannerMs()`), so no one loses
  time, which is the clock rule everywhere else.
- **QUEEN DOWN!** sits inside the boss's move. The move now shows 0.75 s longer, so your turn still comes as long after
  it as before.
- **Auto chess and the Squads banner** are drawn longer only. Neither ever held its game (the step's clock and the block
  ran under them before), and changing auto chess's step lengths is that mode's own tuning.
- **The Hidden Boss's phase change:** his mumbling (the speech rule below) now reads 1.5 s longer, so the seize waits
  for his line about the power to type out (`seizeAt` follows `talkAt`). The phase change is 1.5 s longer
  (`RECLUSE_PHASE2.change.talkMs` unchanged).

## 2. A URL to try the lengths

`?bannerplus=0`, `0.5`, `0.75`, `1` (seconds, 0 to 3) and `?talkplus=0`, `0.5`, `1` (seconds added to every speech line's
read time). Both are test switches (`test-switches.ts`) that count only where the others do (an admin,
`TEST_SWITCHES`, the dev server). They are read from the address once, as the page opens, so they stay for that page
even after a navigation drops the query, until it is reloaded without them. Whether they count is checked each time.
- `?bannerplus=` covers every game played on the device: Boss alone, a solo Crowd and its boss final, the Hidden Boss's
  phase 2, crates, auto chess. `setBannerPlusSource` in core takes the app's value. `SoloMatch` turns it on and
  `NetMatch` turns it off (`timingOnDevice`).
- **Online, the server uses the default.** An online game's screens use the default too, so a different `?bannerplus=`
  can't desync anything. The server's holds stay authoritative, and the online screens draw exactly what the server
  waits for.

## 3. Speech: what cut Babur's line short, and the fix

**Reproduced** (Boss alone, `?boss=tiger&power=hoops&balloon=pawn&stage=4`, his thinking line forced on, every frame
and every `say` logged): his thinking line ("Hmm… a giraffe? No. A knight.") was said while his balloon's cheer ("Ta-da!
Fresh from the pump.") was up. It waited its turn and started as the cheer ended, 2.7 s later. 234 ms after that, his
hoops' line, an ultimate's and so critical, cut in, and the thinking line was gone after a quarter of a second. Nothing
else took lines away in these runs: there was no screen change, remount or reset. Lines without a critical line after
them ran their full time.

**The cause** was the Voice's rule that a critical line cuts in at once on any line that isn't critical, however long
that line had been up. A line that waited its turn could start just as a critical one came.

**The fix, in the Voice, so it holds for every boss and the God King:** once a line has started, nothing takes it off
before it has typed out and been fully readable for `SPEECH.minReadMs` (1.5 s). Each spoken line carries `firm`. A line
that would cut in sooner, whether a critical one or any line over the Hidden Boss's chatter, waits for that, then cuts
in. Lines that wait are still dropped after `waitMs` (5 s).

## 4. Speech: longer, by length

`readMs` 2200 → **2700**; `longChars` **30** (about one row of the bar's bubble at 390 px) and `longExtraMs` **1000**
more past it; `maxReadMs` 4500 → **6500**; `perCharMs` 35, `typeMs` 28, `fadeMs` 260 and `waitMs` 5000 unchanged. A
short line rests about 3 s once typed (was 2.5), a two-row one (50 characters) about 5.5 s (was 4), and none rests
longer than 6.5 s. The `?talkplus=` seconds come on top.

## Tests

- Unit: `packages/app/test/banners.test.ts` checks `POWER_BANNERS` against every view. At 0, 0.5, 0.75 and 1 s, every
  power's banner shows `bossBannerMs()` (drawn through `PowerMoment`, frame by frame), its power starts after it, and
  its moment is what the server holds. Each power's start moves by exactly the extra. It also checks `momentsOf`'s lead
  and `momentAt`, Lights out, the Last Stand and the God King's command, START!, the queen banners, PHASE 2 and 5
  SECONDS!. `speech.test.ts` covers Babur's case (a critical line 200 ms into another waits for its minimum read), a
  waiting cutter dropped after `waitMs`, the read time by length, and `?talkplus=`. `test-switches.test.ts` covers both
  switches parsed and gated, read once, and online off. Tests that waited for the old lengths now follow the setting
  (`powerFxMs`, `voteResultMs`, `kingStrikeMs`, `lastStandMs()`, `bossBannerMs()`).
- e2e: `e2e/banner-time.spec.ts` (Boss alone on a phone, real taps, every painted frame): the toy block, the Big Bounce,
  Lights out, Leapfrog, Babur's warning and QUEEN DOWN!. Each banner is up its length, and nothing after it moves before
  it has gone. `BANNERPLUS=0` plays them at `?bannerplus=0`. The measured table is in the PR.
