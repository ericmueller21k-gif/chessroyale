# The bundle split: the bosses' code off the first load (Nov 16, 2026)

Eric, Nov 16: "that sounds like an important thing to do" (audit L6: the main chunk, about 2.0 MB, carried every boss's code though a
match meets one, and every deploy changed it).

**What changed.** The main chunk went from 2010 kB (707 kB gzip) to 1259 kB (446 kB gzip). On an emulated iPhone 13 with DevTools'
"Fast 4G", cold, home showed at 1690 → 1209 ms (2640 → 1640 ms with the CPU slowed 4x); 710 → 448 kB of script before home. Home,
the boss select's tiles, the menus, quests and profiles draw each boss's portrait from prerendered pixels (`characters/portraits.gen.ts`,
51 kB, made by `packages/app/scripts/portraits.ts`; `test/portraits.test.ts` checks the file and every pixel against his kit). Every boss's
drawings, effects and powers' screens, and the select's stage figure (`components/BossStage.tsx`), come with the match's chunk
(`lazy-game.ts`). Small names the first load reads moved out of the drawings' files: Moo's chat icons (`moo-icons.ts`), Tiger's balloon
names (`tiger-names.ts`), the garden sweep's pace, a battle's figure state (`components/boss-figure.ts`), `animLength`/`cueAt` (sprite.ts).

**Calls.**
- Portraits are prerendered, not his code loaded for a face: the select shows every boss at once. Inside a battle the faces still draw
  from his kit (`BossCharacter.tsx`'s `BossFace`): Hollow's lights recolor his, and his look changes (the Hidden Boss's age and suit).
- The match's chunk is fetched 1.5 s after home shows (where home made the tiles' portraits until now, which cost a slow phone up to a
  second per face; Nov 10's [phone load 2](2026-11-10-phone-load-2.md) kept it until play was near). So the Boss raid screen's stage and a
  match don't wait for it. The service worker downloads every chunk after the first visit anyway (`sw.js`'s precache), so this only
  moves it earlier. Not while a game is starting (the Bot level box, the queue). Until it arrives the stage's spot keeps its size, empty.
- **Not split per boss.** Tried and left out:
  - Rollup's `manualChunks` (a file per boss) pulled the chess rules his drawing imports into the first boss's file, which home then
    loaded, and made cycles: five bosses' drawings import each other's.
  - A chunk's name carries the hashes of the files it imports, so a one-word change on home renamed 71 of the 86 script files
    (measured). Per-boss files would still all change on every deploy, so the cause of "every deploy downloads everything again" is
    this cascade more than the main chunk's size.
  - Loading each boss's code only for his match also needs the tables keyed by every power and effect (`MOMENT_UI` by
    `PowerEventKind`, `EFFECTS`), and the powers' components that import his drawing, to become per-boss registries filled at load. That
    loses the compile-time check that a new power has its moment (LESSONS, Oct 10). With the service worker precaching every chunk,
    it would save parse time at a match's start, not bytes.
  - Next, in order: stop the hash cascade (chunks import stable names through an import map, or a shared chunk that rarely changes),
    then per-boss registries if a phone's match start shows the parse.
- **Left on the first load, and why:**
  - The bosses' sounds (71 kB): `play()` makes a sound at once, by name.
  - The Hidden Boss's drawing (36 kB): his online phase change's timing is read from it as the server's message arrives.
  - The God King (26 kB): the shop's effect preview.
  - `packages/chess`'s boss rules (189 kB of its 250 kB), through `@chessroyale/chess`'s index. These are now the biggest piece:
    their own import path for the app would take them off.
