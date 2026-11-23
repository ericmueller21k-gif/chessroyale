# A boss's banners a second shorter; QUEEN SLAIN! once, for your capture only (Oct 16, 2026)

Two things Eric hit play-testing, fixed together. Lane: targeted (shared timing the server and the app both read; no
protocol change, no stored data).

## 1. QUEEN SLAIN! flashed up after Big Boy's ult

Eric: "Big Boy: he used his ult and idk what happened but the queen slayed banner appeared for like 1 second very
fast."

**Cause.** The boss screen drew QUEEN SLAIN! whenever it showed the boss thinking and the board's last move had taken a
queen (`lastMoveTookQueen(history, bases)`), and the boss's minimum think (`bossThinkMs`) and the lobby's hold
(`bossMinAt`) asked the same thing. Big Boy's Big Bounce comes at the start of his turn, between your move and his, so
his turn thinks twice on the same last move: once while the bounce is picked, once for his move. Take his queen with
the move before the bounce and the banner played in the first thinking, then again in the second, after the bounce:
in Boss alone his move comes as soon as his engine answers there (the time since your move already covers his minimum
think), so it was cut off after about a second. Online the lobby held his move after the bounce for the banner a
second time, while the bounce itself didn't wait for it. The bounce never moves his queen, and no power of any boss
does (Wrangler's drag and Big Boy's bounce move only the crowd's pieces, the toy block and the saw cuts are no pieces,
the funhouse's move is the crowd's); every power that changes the position leaves a base, which the check already
read. A second slip in the same check: it never asked whose move it was, so when Hollow took your queen and thought
again for his extra move, it would have said "QUEEN SLAIN! You take Hollow's queen". Reproduced in the browser (his
queen placed where a pawn takes it before the bounce turn): the banner for 3 s, the bounce, the banner again.

**Fix** (`queenSlain` in `packages/chess/src/boss-timing.ts`, one check for the screen, solo's wait and the lobby's):
the last move is the crowd's and took the boss's queen, and Big Boy's bounce hasn't played since (`powers.bounce.at`
is this turn). `bossThinkMs` takes the boss's view. Online the bounce now waits for the banner (`thinkMinAt`, the
held answer played as the banner ends, an empty answer included), as solo's bounce turn already did; his move after it
doesn't wait.

**Tests.** `packages/server/test/boss-powers-lobby.test.ts` (Big Boy online: your move takes his queen just before the
bounce; on main it fails at once: the bounce isn't held for the banner, and it shows before it), `packages/chess/test/
bigboy.test.ts` (the same in a runner: the banner and its wait before the bounce, neither after),
`packages/chess/test/boss-guard.test.ts` (the boss taking your queen is never QUEEN SLAIN!; not again after the bounce).

## 2. A boss's banners a second shorter

Eric: "We need to dial the time back on the banners because when the bosses ult they are ulting while the banner is
still up, same thing for Toy Blocks: he threw it and we couldn't even see due to long banner time. Do 1 second less."

On Oct 15 every banner got a second longer (DECISIONS.md, "Every banner a second longer"), but the beats after many of
them didn't move: the Big Bounce's leap, the toy block's and the pie's throw, the blizzard's sweep, Lights out's drop
ran under the banner's extra second. Measured on a 390 px phone (Boss alone, real taps, every painted frame): the toy
block's banner was up 2.48 s with his throw at 1.45 s (1.03 s of it under the banner); the Big Bounce's 2.27 s with his
leap at 1.28 s (0.98 s under it). Now: 1.42 s and the throw 17 ms after it; 1.27 s and the leap 13 ms after it.

**Which banners.** A boss's (Eric's words are about the bosses): each power's (the rage warning, every passive and
ultimate), QUEEN SLAIN! and QUEEN DOWN!, "START!", the Hidden Boss's BULLET!, "PHASE 2" and "5 SECONDS!". My call: the
God King's cut-ins (2.5 s; his bolt and slashes already come after them), the Last Stand's (3.1 s), FISCHER RANDOM!,
Squads' block line and the votes' result banner keep their Oct 15 lengths: nothing plays under them, and they aren't a
boss's. The director can extend this if Eric meant every banner.

**How.** `BOSS_BANNER.ms` (1.5 s) in settings.ts. A banner's length is now its band's: it slides in, holds and is off
the board by `--fb-ms`, which `FightBanner`'s and `PowerBanner`'s `ms` set (styles.css: `fb-band-in`, then `fb-band-out`
delayed from `--fb-ms`; without one, the stylesheet's 2.5 s). The entrances inside the band (the slam, the face, the
line, the flash, the portraits) come in its first 0.6 s whatever its length, so they're as they were. The Last Stand's
cut-in keeps its stretched 3.1 s exactly (`--fb-in` 409 ms, `--fb-out` 298 ms). One helper windows every power's
banner (`PowerMoment`'s `banner`, with `until`, the beat its power starts at, and `from`), so a view can't leave one up
past its power.

**Each banner, Oct 15 → now (s on screen):**

| Banner | Oct 15 | Now | Note |
| --- | --- | --- | --- |
| RAGE! (every boss's warning) | 2.5 | 1.5 | |
| FREEZE! | 2.5 | 1.5 | |
| BLIZZARD! | 2.5 | 1.3 | off as the storm sweeps (1.3 s) |
| THAWING! / THAWED! | 2.5 | 1.3 | off as the ice melts (1.3 s) |
| PIE! | 2.5 | 1.45 | off as he throws (1.45 s) |
| FUNHOUSE! | 2.5 | 1.5 | the board turns at about 1.9 s |
| SPIN! / BACK AGAIN! | 2.3 | 1.3 | off as the board turns |
| SPARKLER! | 2.5 | 1.45 | off as he throws |
| ROMAN CANDLE! | 2.5 | 1.5 | |
| DARKNESS! | 2.25 | 1.25 | |
| TWICE! | 2.5 | 1.5 | |
| LIGHTS OUT! | 2.3 | 1.3 | off as he drops |
| TOY BLOCK! | 2.5 | 1.45 | off as he throws |
| BIG BOUNCE! | 2.3 | 1.3 | off as he leaps |
| SPLIT PAWN! | 2.3 | 1.3 | |
| SAW CUT! | 2.5 | 1.5 | |
| BOARD SAW! | 2.5 | 1.5 | |
| LONG PULL! / LASSO! | 2.3 | 1.3 | |
| SHOWDOWN! | 2.3 | 1.3 | |
| DRAW! (Wrangler) | 2.4 | 1.4 | from its beat to the moment's end |
| BULLET! | 2.5 | 1.5 | |
| START! | 2.5 | 1.5 | the intro a second shorter |
| QUEEN SLAIN! | 2.5 | 1.5 | the boss thinks at least 2 s after it (was 3) |
| QUEEN DOWN! | 2.5 | 1.5 | inside the boss's 3.1 s move, as before |
| PHASE 2 | 2.4 | 1.4 | the phase change a second shorter (14.8 s after the fall) |
| 5 SECONDS! | 2.5 | 1.5 | its window was 2.8 s over a 2.5 s banner |

(Oct 15's numbers are what was on screen: a window longer than the 2.5 s animation showed 2.5 s.) Each is exactly a
second shorter, except five that now end where their power starts, so nothing of it plays under the banner: the toy
block's, the pie's and the sparkler's throw (1.45 s, 1.05 s shorter) and the blizzard's sweep and a thaw's melt (1.3 s,
1.2 s shorter). None is near nothing: the shortest is DARKNESS!, 1.25 s, as before Oct 15.

**The moments around them.** Those that grew a second on Oct 15 for the longer banner are a second shorter again, so no
second passes with nothing on screen (`POWER_FX`, shared by the server and the solo game): the rage warning 2.7 → 1.7
s, freeze 3.3 → 2.3, thaw 3.2 → 2.2, pie 3.3 → 2.3, sparkler 3.3 → 2.3, Hollow's extra move 3.2 → 2.2, toy block 3.3 →
2.3, saw cut 3.3 → 2.3, the showdown 7 → 6. Boingo's board turns a second sooner again (it waited for the longer
banner): the funhouse 6.2 → 5.2 s (`FUNHOUSE` clownAt 1.3, lineAt 2.7, moveAt 3.5, exitAt 4.5), each spin 3.6 → 2.6 s
(`SPIN` 1.3). The moments that held their banner already keep their length (the blizzard, the candle, the dark, the
Big Bounce, the split, the board saw, the lasso, BULLET!). Nobody loses clock time: every moment still comes before the
crowd's clock starts, solo and online, from the same numbers.

**Tests.** `packages/app/test/banners.test.ts` reads each power's banner from its own view's code: a second shorter
than on Oct 15 or gone at its power's beat, inside its moment, never under its power; the moments, START!, the queen
banners, PHASE 2, 5 SECONDS!, and the God King's and Last Stand's unchanged. `e2e/bigboy.spec.ts` watches every frame
(`watchSpans`): the toy block's banner gone before the block flies, the Big Bounce's before he leaps. The e2e checks of
BLIZZARD!, THAWING! and THAWED! (1.3 s now) watch for them from before they can appear (`watchFor`), as
.claude/LESSONS.md says for anything on screen for about a second.

Frames (390 px, before and after): see the PR.
