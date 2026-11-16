# Chandy: wiring his art (for the rules job)

His design is `DESIGN.md` on branch `stills/boss-chandy` (round 2c on top; answered questions marked ✅). The art (Nov 16) is all in
place, unwired; this is what each piece expects.

## His figure and kit

- `characters/chandy.ts`: `CHANDY` (174 x 126 frame, feet [58, 116], facing our right), animations `idle`, `point`, `fire`, `aim`,
  `stow` at each rifle stage: `chandyAnim(name, stage)` gives `idle`, `idle_s1` … `idle_s5`. Stage = locked pieces taken, 0 to 5.
- His kit is `ART_KITS.Chandy` (kits.ts). To put him in the game: add him to `BOSS_ROSTER` (core `boss.ts`, admins first), move the
  kit into `BOSS_KITS` under his roster name, add `CHANDY` to `CHARACTERS` (characters/index.ts) and run the tests that then walk him:
  `battle-desktop.test.ts` needs his `SIDE_REACH` (his reach is measured with the rifle held level: consider measuring the rest frames
  only, or he widens every boss's side room), `bar-fit` his `barScale`/`barShift`, `boss-result-lines` his result lines and goodbye,
  `boss-select` his framing (`CHANDY_SELECT_FRAMING`) and tint.
- The kit maps every moment at stage 0. The stage has to reach the kit's choice of animation: either per-stage kits, or a
  `BossKit` hook that names the animation from the battle (as `lineOf` does for lines).
- Sounds: `CHANDY_SOUNDS` are placeholders from other packs; `CHANDY_CUES` says what each cue should be. His own pack goes in the sound
  worker (`MAKE` in sound.ts, `characters/boss-sounds.ts`).

## His clones (Dodge)

`CHANDY_CLONE` (the clone look, `CHANDY_CLONE_PALETTE`, kept from round 1's scrambled GIF): `level`, `down` (loops), `blinkLevel` /
`blinkDown` (a teleport's blink out), `appearLevel` / `appearDown` (in on the new square), `fadeLevel` / `fadeDown` (the afterimage,
about half a second). `cloneMuzzle(pose)` gives where each pose's line starts.

## Board art (power-art.ts EFFECTS, on the shared board-effects canvas: `BoardEffects` items)

| Effect | Start, loop, end | For |
| --- | --- | --- |
| `chandyCrosshair` | `lock`, `held3` → `held2` → `held1` (stages: its turns left), `drop` | each lock (up to two); `held` has no pips |
| `chandyScatterBurst`, `chandyScatter` | `burst`; `land`, `held`, `fade` | scatter shot's spot and its 4 blocked squares |
| `chandyBeam` | `rowIn`/`row`/`rowOut`, `colIn`/`col`/`colOut`, `crossIn`/`cross`/`crossOut` | the beam's squares (opaque) |
| `chandyShield` | `up`, `held`, `pop` | his two shielded pieces |
| `chandyDizzy` | `hit`, `dizzy`, `clear` | rapid fire's three pieces |
| `chandyQueenAim` | `on`, `aim`, `fade` | the queen lock's line down her file, before your move |
| `chandyRound`, `chandyShatter` | `fly` (head), `trail` (each square crossed); `shatter` | the shot, and the piece in the way |
| `chandyDodgeRow`, `chandyDodgeCol` | `flash`, then `blast` | Dodge's lines (ChandyDodge places them) |

## The upgrade window and Dodge

- `components/ChandyUpgrade.tsx`: `<ChandyUpgrade stage={1..5} move="Shields" since={ms} />`, placed over the board's box;
  `UPGRADE_MS` (2 s) later take it away. Its animations run from `since`.
- `components/ChandyDodge.tsx`: `<ChandyDodge view={…} />` over the board's box (`--board-size` set on it). `DodgeView`: `phase`
  (`scope`, `slide`, `open`, `vote`, `locked`, `blast`, `result`) and `since`, `side`, `king` (his own square), `center` (e4 White,
  e5 Black), `placed`, `lines` (a rank's clone `{ rank, side: "left" | "right" }`, a file's `{ file }`, `since` when it appeared),
  `ghosts` (afterimages, `since` when they left), `votes`, `mine`, `endsAt`, `round`, `teleport`, `result`, `onPick`. The real
  board's pieces are the caller's to hide from `open` on (and its king from `scope`). Timings in DESIGN.md D3a.

## Seeing it

Admins: `/chandy` in the app (or `npm run dev`, then `/chandy-preview.html`). `npm run frames:character -- <dir> Boingo both
kit=Chandy` plays him in a battle.

## From the art review (Nov 16)
- **Time:** solo and online pass both components the same view, built from the shared match state; neither keeps game state. Every
  `since` / `endsAt` is this device's time (online: `local(serverTime)`, `net.ts`), never a raw server time, so a fast or slow clock
  never shortens or stretches the 3 s vote.
- **The teleport schedules are tunables:** rounds 1 to 3 (1.2 s; 0.9 and 1.6 s; 0.8, 1.4 and 1.8 s) go in `settings.ts`, with a unit
  test that the last teleport is always 1.2 s before the vote closes. Today only the preview holds round 3's.
- **Frame cost:** the scope-in animates a `backdrop-filter` blur under a moving mask for about 0.9 s over the whole board. Run `@perf`
  on the scope and slide; if they drop frames on a phone, swap the blur for a plain dark radial gradient.
