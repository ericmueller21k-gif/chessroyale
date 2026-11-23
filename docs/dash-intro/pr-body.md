# Dash's challenge intro: his four dashes and the clock rush (round 3)

Eric (Nov 5): "I just played Dash and he didn't even do the dash stuff, it was the default thing. He's supposed to run and grab the
board etc." His challenge now plays his own intro (Eric's design, Nov 3), drawn on `claude/boss-art` at 90b3bd56, wired the way
Ginger's and Jefferson's are. Dash is still in the game for admins first (`BOSS_ADMIN_FIRST` is untouched), so admins see this.

**Lane: the boss lane** (boss content: art and wiring). Specs it runs: `e2e/boss-challenge.spec.ts` (the town area: `town/shops/**`,
and now `characters/dash-intro.ts`) and Dash's own area (`e2e/dash.spec.ts`, `e2e/boss-smoke.spec.ts`: `characters/dash*.ts`,
`boss-blitz.ts`). The boss kit unit test (`packages/chess/test/boss-kit.test.ts`) passes locally. It still needs the boss lane's quick
review pass.

## What changed

- **His moves and props, copied as drawn** from `claude/boss-art` (90b3bd56):
  - `packages/app/src/characters/dash-intro.ts`: `BOSS_BLITZ_INTRO` (bolt, arrive, dashBy, brag, idle) and `BLITZ_INTRO_DROP_AT`. Only
    the imports changed. The rig they share (palette, parts, legs, shoes, poses, stars, finger gun) is now exported from `boss-blitz.ts`.
    Nothing else changed there, so his town and battle frames are as before.
  - `packages/app/src/town/shops/blitz-intro-art.ts`: the shoe-box table and stool (`land`, `idle`), the dust trail, the pieces' pop,
    and the clock rush (`INTRO_BLITZ_STORM`, `_FRONT`). The review sheet stays on the art branch. It loads as one lazy chunk (18 kB) only
    when you challenge him.
- **His timeline** (`town/shops/challenge.ts`):
  - `BOSS_INTROS.dash` is now `custom: true` and `seated`, with his own place (`clear` 2.08) and his cues.
  - `CHALLENGE_FEEL.blitz` holds `lineMs` 1800, `awayMs` 200 and `holdMs` 80.
  - The beats are `face`, `line`, `dashTable`, `dashBoard`, `dashPieces`, `dashStools`, `brag`, `swing`.
  - New functions: `blitzAnims`, `blitzTimes`, `blitzAt` (`BlitzNow`) and `blitzCues`.
- **The loader and the room:**
  - `intro.ts` loads `DashArt`.
  - `ShopRoom.tsx` draws it: his dust trail at his spot under him (`drawBlitzDust`); his own frames, or none of him while he's off
    (`drawBlitzBoss`); and the table, both stools, the board falling on, the pieces and the pop (`drawBlitzCenter`).
  - The `__shopIntro` test hook gains `blitz`.
- **Two new synthesized sounds** (`characters/dash-sounds.ts`, `sound.ts`):
  - `dashThud`: a cardboard thump for the table, the board and the stools.
  - `dashBrush`: his jacket being dusted off.
  - Each sits about 4 dB under a move and is finite at 24, 44.1 and 48 kHz.
- `e2e/areas.json`: `characters/dash-intro.ts` is added to the town area's paths (next to Ginger's intro), so changes to it run the
  challenge spec.
- Docs:
  - `docs/decisions/2026-11-05-dash-intro.md` (the calls).
  - `docs/areas/town-square.md` ("Dash's challenge", "Which bosses", the tests).
  - `docs/areas/bosses.md` (his row).

## Player-visible changes (admins, while Dash is admins-first)

- **Challenging Dash in his store plays his own intro, not the default one.** You both walk straight to where you stand through the
  whole intro:
  - He stops 2.08 squares west of the table, a little behind his try-on mat.
  - You stop 2.2 squares east, just past yours.
  - Neither of you hops back any more.
- **His line** shows in his bubble for 1.8 s (it was 2.5 s). The text is the same: "Yo yo yo! Dash in the building, fam!"
- **Four dashes.** Each time he grins, snaps round, bolts off to the left in a trail of dust, races back, skids onto his spot and tosses
  something:
  1. The shoe-box table lands with a thud and a squash. It is three crooked boxes, orange, black and orange with a teal lid.
  2. The board falls onto it with a thud. The squares are mint and orange, and the slab is the teal shoe-box lid.
  3. The pieces appear in a sparkle pop. They are the town's pieces.
  4. Both shoe-box stools land, a square each side of the table.
- **His brag:** he dusts off his jacket, then winks and finger-guns you with a glint.
- **He stands through the attack's beat** (1.4 s). No God King attack was drawn for him, as with the default intro.
- **The clock rush covers the screen** instead of the flash and the black wipe: digital readouts, stopwatches and second ticks racing
  across. The battle loads under it and it slides off.
- **Sounds:**
  - His whoosh as he bolts and comes back, and his sneaker squeak on each skid.
  - His zip on each toss, and the new cardboard thud as the table, the board and the stools land.
  - The app's soft pop as the pieces appear.
  - The new brush, twice, as he dusts off his jacket, and Tick's ding on the glint.
  - The rush's clock whirr as it comes in, then its tick.
- **Timing:** 10.25 s from the marks to the cover starting (about 10 s from his line). The art's mockup was 9.0 s with a 0.9 s line and
  0.7 s of standing where every boss's attack beat is 1.4 s.
- Everything stands before the cover, and nobody moves once the stools land. At rest he is always fully on screen, on a phone and a
  computer. He leaves the screen only mid-run, in the bolt's last frames and the arrive's first two.
- No new text. No emoji.

Stills (phone and computer) are in `docs/dash-intro/`. Each was taken on the frame its moment shows (the page's frames are held for the
screenshot):
- `dash-bolt-*`: him mid-run in his dust.
- `dash-drop-*`: the board falling onto the shoe boxes.
- `dash-pop-*`: the pieces' pop.
- `dash-stools-*`: the stools landed.
- `dash-brag-*`: the finger gun.
- `dash-wipe-*`: the clock rush.

Known look: in the bolt's last running frame (60 ms) the art's 150 px frame cuts his afterimage off straight at its left edge. This is
the art's frame, unchanged.

## Changed checks (old → new)

None of these guards a rule in `docs/rules/eric.md`.

- `packages/app/test/boss-challenge.test.ts`, "every boss whose home has an inside has an intro…":
  - Title: "…Babur, Puddles and Dash the default" → "…Ginger and Dash their own, Babur and Puddles the default".
  - Dash's entry: `{ custom: false, cues: { table: "pop", wipe: "dashWhoosh" } }` → `{ custom: true, seated: true, cues: { pop: "pop",
    storm: "dashWhirr" } }`. The name, line and layout are the same.
- `packages/app/test/boss-challenge.test.ts`, "once the stools are in, no figure near the floor is in front of a stool…":
  - Dash's stools: the park table's (`TABLES.dash = PARK_TABLE`) → his shoe-box stools (`INTRO_BLITZ_STOOL`, a square each side, seat
    `INTRO_BLITZ_STOOL_SEAT_H`), measured as Timber's stumps are.
  - His clear place is now his own 2.08; the test already read `introOf(id).clear`.
  - The 0.1 gap and every other boss's check are unchanged.
- `packages/app/test/dash-wired.test.ts`, "his sounds are his own… every one used":
  - The used set: his kit's sounds and his select sound → those plus his intro's cues (`BOSS_INTROS.dash.cues`). The new
    `dashThud` and `dashBrush` are used only there.
- `e2e/boss-challenge.spec.ts`, Dash's test:
  - Old: "the default intro in his store". He and you stood on the mats ([8, 10.5] and [11, 10.5]), the table popped in, you both hopped
    back (`clearOfStools`), he stood through the swing, and the flash and wipe ran (`canvas.boss-wipe`).
  - New: "his own intro in his store":
    - You stand at [11.7, 10.5] and he at [7.42, 10.5], from the line to the swing.
    - His beats come in order.
    - The table, the board, the pieces and the stools each appear on their own toss, in that order.
    - He is off four times.
    - Nothing is missing from the stools on.
    - At the swing: no attack, table and stools in place, `blitz` idle.
    - The clock rush covers (`canvas.boss-storm`, `data-boss="dash"`), the battle runs, and you return where you stood.
- The file comment at the top of `e2e/boss-challenge.spec.ts` describes Dash's own intro.

**New checks** (`packages/app/test/dash-wired.test.ts`, "Dash's intro"):
- His beats in order, each one a feel number or the art's frames, with 9 to 10.5 s from his line to the cover.
- Each dash's bolt, gone, arrive, skid and toss.
- Each thing lands on its toss, and nothing pops in or hops after the stools.
- The drops land where the table and stools stand: his place is the art's toss reach, and the stools are a square, 37 px, each side.
- Every cue of his intro's art has a sound the game makes, played on its frames.
- No emoji in his line.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
