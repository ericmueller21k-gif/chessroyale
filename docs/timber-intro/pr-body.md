Title: Timber's own challenge intro: he carries a giant log to the middle, gnaws it, and the shavings settle into his table (admins first)

**Lane:** targeted (animation timing and drawing in the challenge room, the challenge area), with a boss's art and wiring: the boss
lane's quick review pass is suggested. Specs CI should run: `e2e/boss-challenge.spec.ts` (the challenge area: Alfil's, Babur's, Big
Boy's and now Timber's intros share the room's drawing), plus whatever `e2e/areas.json` selects for `characters/timber*.ts` (Timber's
`timber.spec.ts`, `boss-smoke.spec.ts`, `king-attack.spec.ts`: timber.ts only gained exports and the art's cheek `puff`, which draws
nothing new when it's 0).

## What changed
- **Timber's challenge has its own intro** (Eric's design, the art branch's `scripts/boss-art/out/intro-timber-nov3.md`, its mockup
  approved): you and Timber walk in to his circle's branded marks (as before); a giant log already lies on the floor to the left; he
  says his line, "Hard hats on. We're building today." (unchanged), and sets off west for the log while it's still over his head; he
  heaves it up, carries it to the middle (strained, cheeks puffed), stands it on end where the board goes and gnaws it (chips flying, the
  log chewed into an hourglass); a fog of shavings and sawdust boils up and hides it, holds, and settles to a ring of shavings on the
  floor: the log is now his table (a gnawed log pedestal, a maple and walnut board, the real board and pieces on it); two little wooden
  stumps pop up out of the floor as the seats (you hop back clear of yours, as for every boss's stools); he dusts off his paws, chitters,
  walks to his place and swings his God King attack; his sawdust sweep covers the screen (played as Alfil's sandstorm) while the battle
  loads under it. About 12.1 s from the marks to the sweep, 12.7 s to covered (Eric's "about 12 s"; the notes' 12.6 s); about 16.5 s
  from Fight. Every cue is one of his own sounds (`characters/timber-sounds.ts`). Boss on the left, you on the right.
- **Wiring, as Alfil's and Big Boy's:** `BOSS_INTROS.timber` is `custom` (layout "across", his room's marks); his moves
  (`BOSS_BEAVER_INTRO`, the art's lines in `characters/timber-intro.ts`, so the town never builds them) and the props
  (`shops/timber-intro-art.ts`: the log, the shavings' fog, his table and palette, the stump, the sweep) load as their own chunk only when
  you challenge him. The timeline is `introBeats` with a third kind of art, a log (`LogAnims`, `woodAt`); every beat a number in
  `CHALLENGE_FEEL.log` (where the log lies, the line's lead, the walk and carry paces, the fog's hold, his place to swing) or the art's
  frames. The room draws his moves at his town size (mirrored to walk west), the log at the same size, the fog, table and stumps at the
  room's; the fog over him, you in front of it.
- **The art's fog, made fast to load:** as copied, building it took about 2 s on a computer and over 8 s at a phone's speed; the app's
  copy works out each frame's dome once and checks a billow's box before its distance: the very same pixels (a test keeps their hash),
  and the chunk now loads as fast as Alfil's (about 1 s; 3 s at 4x CPU throttling).
- **His place to swing** is 2.7 squares from the table's middle (`log.clear`; every other boss's stays 2.6): his stump's roots spread
  wider than a stool, so at 2.6 his attack's feet came too near it.
- **Nothing changes for players** (Timber is in the game for admins first: only an admin's town has his lodge) **or for onlookers** (you
  both go inside, as with every boss). The town's frame loop and drawing are unchanged (not measured); in the room, his challenge draws
  a few more pictures a frame than the others'.
- Decision: `docs/decisions/2026-11-03-timber-intro.md` (where his moves live, the fog's load time, the timeline, the log's place,
  the scales, the stumps popping after the fog settles rather than under its hold, his place to swing, the draw order, the sounds).
  Area page: `docs/areas/town-square.md` ("Challenging a boss").

## Player-visible changes (admins only, while Timber is in the game for admins first)
- Challenging Timber plays his own intro (above) instead of the default (the table popping in, his attack, the flash and the wipe).
- No new text. His line is unchanged: "Hard hats on. We're building today." It now stays its 2.5 s over his head while he walks to
  the log (it was said standing still).
- New sounds in the intro, all his existing ones: hup, thump, gnaw, chomp, clatter, saw, slide, knock, pat, chitter, and his swoosh as
  the sweep comes in (was his swoosh on the default's flash, and the app's pop as the table appeared).

## Stills and GIF (`docs/timber-intro/`)
- `intro-phone.gif`: the whole intro on a phone (390 x 844), real timing, from the Fight tap to the sweep covering the screen.
- `table-desktop.png`: one frame on a computer (1280 x 800): the table with its stumps after the fog has settled, Timber at his place
  swinging.
- `table-phone.png`: the same moment on the phone (390 x 844).

## Tests
- Unit, `packages/app/test/boss-challenge.test.ts`, new "the intro's timeline (Timber's log, Nov 3)": the art (frames per move and prop,
  his reach and step back, his table the park table's geometry, the palette, the sweep's tiles); the fog's frames pixel for pixel (hash);
  his room's marks match the timeline (his mark, his place, the log west of his mark and on the floor); the beats in order, each from
  where the last ended, every one a feel number or the art's frames, 11 to 13 s in all; his line's whole `lineMs` while he walks; where
  he is and which way he faces each beat; the log hidden the moment the heave starts, standing from the set-down's last frame, gnawed,
  gone under the hold; the table and stumps never shown before the fog's hold (the table under it, the stumps popping once it settles),
  the ring kept; the stumps at the table's foot ± 37; every cue a sound of his own, each on its beat, in order. Passed (50).
- e2e, `e2e/boss-challenge.spec.ts`, new "challenging Timber in an admin's town": as an admin, his card's Challenge, in with him, the
  log lying there as you walk in, his line on the marks (bubble only, not the chat), the walk west (facing west), the heave (the lying
  log gone), the carry, the gnaw (the log gnawed), the fog, the stumps at your sides, the dusting off, his attack from his place, the
  sweep (`canvas.boss-storm`, `data-boss="timber"`) covering, the battle under it, Leave back to where you stood; never the lying log
  after the heave, never a stump before the fog; no page errors. Passed on the phone and the computer locally.
- Also run: `boss-kits.test.ts`, `packages/chess/test/boss-kit.test.ts`, `town-timber.test.ts`, `shop-room.test.ts`,
  `timber-sounds.test.ts`; `npm run typecheck`.

## Changed checks (old → new; none guards a rule in docs/rules/eric.md)
- `boss-challenge.test.ts`, "every boss whose home has an inside has an intro": `introOf("timber")` was `{ custom: false, cues: {
  table: "pop", wipe: "timberSwoosh" } }` → `{ custom: true, cues: { storm: "timberSwoosh" } }` (his own); its title "Alfil and Big Boy
  their own, Babur, Puddles and Timber the default" → "Alfil, Big Boy and Timber their own, Babur and Puddles the default".
- `boss-challenge.test.ts`, "the layout: across for all four today" → "all five": Timber added to the list.
- `boss-challenge.test.ts`, "the hop back": Timber's log added to the intros checked (null, Big Boy's, Alfil's → and Timber's).
- `boss-challenge.test.ts`, "once the stools are in, no figure near the floor is in front of a stool": Timber was measured against
  the park table's stools at the shared clear place (`clear.boss`, 2.6) → against his own stumps (one `stoolOff` a side, their roots'
  width, their seat height) at his own clear place (`log.clear`, 2.7, through `marksFeel`). The same gap (0.1) for everyone.
- `e2e/boss-challenge.spec.ts`: the `Intro` hook type gained Timber's `wood`; a new test; the others unchanged.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
