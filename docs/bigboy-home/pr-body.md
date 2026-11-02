# Big Boy's home (a shop) with his own challenge intro, and Timber's God King attack

Branch `claude/bigboy-home`, from `claude/boss-challenge` (PR #466, not merged yet: merge #466 first; main to be merged in when it
lands, never rebased). The art is from `claude/boss-art` (`scripts/boss-art/out/shop-bigboy-nov2.md`, `intro-bigboy-nov2.md`,
`timber-king-attack-nov2.md`). Decision note: `docs/decisions/2026-11-02-bigboy-home.md`; area pages: `docs/areas/town-square.md`
("Which homes", "Challenging a boss"), `docs/areas/bosses.md` (a boss's attack on a king).

## What changed

**Big Boy's Crib is a shop**, as Babur's, Puddles' and Alfil's are: his card says "Go in"; the room is the art (`town/shops/bigboy-art.ts`,
its imports moved, its room still and review strips left on the art branch, three lines of the airplane's drawing typed for the app's
stricter checks): a ball pit (solid) under a foam walkway, the quilted shop platform and the rainbow battle circle you walk on; Blocky (his
kid's sprite) the Shopkeeper behind the letter-block counter; "Big Boy's Boss Crate" (core's `BOSS_CRATES`: Big Boy's Buggy first, the same
price and odds); a nursery ceiling (sky blue, clouds, little stars: the mockup's); the chat's day tone. His circle's start marks, drawn
north and south, are turned west and east (a square and a half out, where the challenge stands you), the middle line north to south. The
toy airplane is a deep piece (3 x 3 squares) that stands up whole at its foot (`RoomArt.upright`), not laid flat. Its own chunk: 32 kB.

**Big Boy's challenge intro** (`BOSS_INTROS.bigboy`, layout "across", his own art: `town/shops/bigboy-intro-art.ts`, 10.5 kB): his line in
the bubble; six alphabet blocks drop in and stack 3-2-1 (B-I-G, B-O, Y), a clack each and a bonk for the top one; the board drops onto the
top block (his toss) and plops on (dust and stars, a poof); two stool blocks drop in at your sides (a clack each); the table alone a
moment; his God King attack beside the table from 2 s before the cover (as Alfil's); his lollipop swirl sweeps over the page, played as
Alfil's sandstorm (his swish); the battle loads under it. About 1.2 s walking in, 3.7 s of intro, 0.6 s of swirl. The timeline code is
Alfil's, generalized (`BlocksAnims` beside the pyramid's: `introBeats`, `introAt`, `introCues` read the art's own frame cues). The board is
lifted until its slab's front rests on the top block (`slabFrontY`): laid at the art's height, the slab reaching toward you hid the upper
blocks.

**Timber's God King attack:** `BOSS_BEAVER_ATTACK` from the art (`characters/timber.ts`, its lines only, plus the `KING_ATTACK` import),
his kit's `kingAttack` (`perSquare 40`, `stand 1.15`, `facesLeft`): he drops in hammer high, hammers the king (whacks and knocks in turn),
bats it with the plank off his back, smashes it down on its head, chitters and hops off. His attack's cues play his own wood sounds
(`kingAttack.sounds`, a new optional map on `KingAttackKit`: swoosh, thump, whack, knock, slide, chitter, hup; his kit's own `whack` stays
the gnaw as he takes a piece). Wood chips off the king's square each hit (`chipHit`, `effects/timber.ts`, drawn by code as the notes
suggest: up and out for a whack, sideways for a knock or the bat, a big burst for the smash). `timber` is in `KING_ATTACKERS`
(boss-timing.ts): it plays in the God King's Last Stand and at his mate; the only rule that reads the list is the mate's longer hold, so
his Gnaw cap (two a battle) is untouched (`packages/chess/test/timber.test.ts` "Gnaws at most twice" passes). He's admins-first, as before.

## Every player-visible change and new text

- Big Boy's home card: his home's name and **"Go in"** (was: the name, "Shop" greyed, "Coming soon").
- Inside: the header **"Big Boy's Crib"**; **"Shopkeeper"** / **Talk**; **"Big Boy's Boss Crate"**, **"Big Boy's Buggy"** (Mythic ride),
  **"3 Big Boy tokens, or 1 Big Boy token + 1 crate key"**, **"You have 0 Big Boy tokens and 0 crate keys."**, **"Buy with 3 Big Boy
  tokens"**, **"Buy with 1 Big Boy token + 1 crate key"**, **"Big Boy's Boss Crate is in your inventory."**; "Go out". The room canvas's
  label **"Inside Big Boy's shop"**.
- The Crates tab lists **Big Boy's Boss Crate** ("Big Boy's Buggy, and the Beta Crate's hats, shades and gear"; the rows are generic), and
  the FAQ's boss-crate line names it (generated).
- Big Boy's card, "Challenge alone": **"Challenge Big Boy?"** / **"You'll fight Big Boy in Boss Battle, then come back here."** / **Fight** /
  Stay (was "Leave the town square?" / "You'll fight Big Boy in Boss Battle." / Leave / Stay). Fight takes you into his crib for the intro
  and the battle, and back to town after (the result's **"Back to town"**, the gear's Leave note as for the others).
- His line, in the bubble by his head (a placeholder until Gemini's, a baby's voice): **"My blocks! My board! Big boy go first!"**
- The server's town-chat lines name him: "Ann challenged Big Boy!", "Big Boy beat Ann in 21 moves.", … (the existing lines).
- The blocks, the board's drop, the stools, his attack, the lollipop swirl (art and sounds as above).
- Timber: his attack on the God King in the Last Stand and on your king at his mate (art, chips, sounds). No line as he lands (none
  written yet).

## Changed checks (old → new)

- `packages/chess/test/king-attack.test.ts`, "holds for the attack at a mate…": `KING_ATTACKERS` `[…, "tiger", "folio"]` → `[…, "tiger",
  "folio", "timber"]`.
- `packages/app/test/king-attack.test.ts`: "is every playable boss's but the Hidden Boss's…" the same list → `+ "timber"`; the facing test's
  `FACES` gains Timber (`keys: "xX"`: it runs on every kit with an attack).
- `packages/app/test/shop-room.test.ts`: "only Babur's, Puddles' and Alfil's homes have an inside" (`["alfil", "gardener", "tiger"]`) →
  "…and Big Boy's" (`["alfil", "bigboy", "gardener", "tiger"]`); the room tests run on Big Boy's room too, and two of them take each
  room's own spots: "every square you can stand on is reachable…" walked to `(2, 2)` and `(17, 1)`, and "a tap … on a wall, beside it"
  tapped `(0, 15)`, for every room → the same for the other three; Big Boy's (a ball pit but for its raised floors) `(4, 1)`, `(15, 1)`
  and the back wall `(6, 0)`. "the crates' words" and "each shop sells its boss's crate" take Big Boy's too.
- `packages/server/test/boss-tokens.test.ts`, "the crates": `BOSS_CRATES` `[tiger, gardener, alfil]` → `[tiger, gardener, alfil, bigboy]`.
- `packages/app/test/boss-challenge.test.ts`: "every boss whose home has an inside has an intro" (`["alfil", "gardener", "tiger"]`) →
  `["alfil", "bigboy", "gardener", "tiger"]` (Big Boy custom, his line); "the layout: across for all three" → all four; the marks' room
  tests (`ROOMS`) run on Big Boy's room too (the same numbers); "Alfil's kit has one (every playable boss's does but Timber's…)" → its title
  only.
- `e2e/king-attack.spec.ts`, the Last Stand's assaults: + Timber (an admin's battle: `asAdmin` for an admins-first boss; without it
  `boss=timber` silently plays another boss).
- None of these guards a rule in `docs/rules/eric.md`. No check removed.

New checks: `packages/app/test/shop-room.test.ts` "Big Boy's: you walk on the walkway, the shop's platform and the battle circle; the ball
pit is solid, and so are the airplane's 3 x 3 squares and the props"; `packages/app/test/boss-challenge.test.ts` "Big Boy's drawn start
marks…" and "the intro's timeline (Big Boy's toy blocks)" (the art's frames and cues, the beats, the board's drop, the stools, every cue's
sound, the length, the attack's start); `packages/app/test/king-attack.test.ts` "Timber's attack on a king" (the kit's numbers, the ten hits
on the shared beats, a sound of his for every cue and all ten under a move, the reach, the chips); `e2e/boss-challenge.spec.ts` "challenging
Big Boy in the town" (phone and computer); `e2e/shop.spec.ts` "Big Boy's Crib" (phone and computer). `e2e/areas.json`: Timber's area maps
`effects/timber.ts` and runs `e2e/king-attack.spec.ts`.

## Tests run locally

- Typecheck (app). Unit: `packages/app/test/{king-attack,shop-room,boss-challenge,gingerbread,timber-sounds}.test.ts`,
  `packages/chess/test/king-attack.test.ts`, `packages/chess/test/timber.test.ts -t Gnaw`, `packages/server/test/{boss-tokens,ci-select}.test.ts`,
  `packages/core/test/crates.test.ts`, `packages/app/test/faq.test.ts`: all pass.
- e2e (under the shared lock, on a port of its own): `boss-challenge.spec.ts -g "Big Boy"` phone and computer, `shop.spec.ts -g "Big Boy's
  Crib"` phone and computer, `king-attack.spec.ts -g "against Timber"` phone (the computer runs the two widest figures only): all pass.
- Frame rate: the town's drawing and frame loop are unchanged; not measured (eric.md: only when they change). In the room, a shop draws one
  more upright piece (the airplane); a challenge adds the blocks' frame and the board as Alfil's adds his pyramid.

## Stills and GIFs (`docs/bigboy-home/`)

- At the counter: `bigboy-counter-phone.png`, `bigboy-counter-desktop.png`; his crate's card: `bigboy-crate-phone.png`.
- At the table: `bigboy-table-phone.png` (his attack beside it), `bigboy-table-desktop.png`.
- GIFs (phone): his intro, from the walk in to the swirl and the battle under it, `bigboy-intro-phone.gif`; Timber's attack on the God King in
  his Last Stand, `timber-attack-phone.gif`.

## Lane

Boss lane (boss art and wiring: Big Boy's room and intro, Timber's attack and kit; the shared boss kit's king-attack checks), targeted for
the intro's timeline and the room's drawing. It also adds a fourth boss crate to `BOSS_CRATES` (the existing price and odds, no schema
change) and `timber` to `KING_ATTACKERS` (the mate's hold, solo and online): the director may want the full lane for those.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
