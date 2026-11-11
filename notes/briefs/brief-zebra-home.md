# Brief: Rolling Dough, Don Dough's bakery in the town (front room, back room, chatter, challenge). Opus, high

Branch `claude/zebra-home` from origin/main (create it; `npm ci`). Read `CLAUDE.md`, `docs/rules/eric.md`,
`docs/areas/town-square.md` ("Inside a shop", "Challenging a boss", "Adding a home"), and include `notes/briefs/rules-common.md`.
**Eric's words: `notes/zebra-eric.md`** (it wins). Notes and briefs are on `claude/director-notes`.

## The art (approved: "Looks great"; don't redraw)
On `origin/claude/boss-art` (read with git show; copy in as Hollow's cave and Timber's shop came in): `scripts/boss-art/out/house-shop-zebra/`
(`house-shop-zebra.ts`), the notes `shop-zebra-nov10.md` (piece tables, both floor masks, doors, marks, lights, cameras, **what the code
must add**), the crew `crew-zebra/`, Don `boss-zebra/` (his `sit*`, `relax`, `breadPop`), the chatter `zebra-chatter-nov10.md` and lines
`zebra-openings-nov10.md`. Eric's stills: `origin/stills/zebra-bakery` (match them).

## Build
- **The home "Rolling Dough"** on the town (Big Boy's footprint). Admins only while Don Dough is admins first (the same flag the boss
  uses, `BOSS_ADMIN_FIRST` with id `zebra`; check how admin-first content is gated).
- **The front room:** smaller inside; the counter and bread; the **Big Mix** mixing dough (looping, cheap); **two guards by the door
  whose `watch` follows you**; the shopkeeper zebra in a baker's cap at the counter ("Shopkeeper", no name; bake him as the other
  sidekicks, not a town bot). No crate yet (his crate's items come later): the shopkeeper's chat only, with "nothing here but a bakery"
  lines.
- **The back-room door (new):** a door at the back left that loads the second room (its own floor mask, arrival spot, camera, and the
  way back). Build it so a later home can reuse it. The camera never shows past a room's edge.
- **The back room:** the table, the scattered pieces, the TV's chess stream (a cheap loop), the wall theory, Don in his chair and three
  crew. **The chatter** loops in speech bubbles (the crew argue, Don one-ups them), paused while you talk to him.
- **The talk beat:** walk up to Don and talk: the crew stand and `draw`, aim at you (one line), Don's `relax` with his line, they
  `lower`, his challenge line, then the challenge (admins: into the battle with `zebra`). The challenge intro as data:
  `town/shops/intros/zebra.ts` (`defineIntro`; "Challenging a boss"), played at the back-room table.
- Sounds from the cues (mixer, TV, door, chatter murmur) the way the other homes' are, quiet.

## Keep
- Frame rate in the town (eric.md, the town square): measure the bakery vs another home the eric.md way, phone and computer.
- Every other home exactly as it is (their tests prove it). Sprites always fully on screen.
- The boss's rules and battle screen are **another helper's** (`claude/boss-zebra`): don't touch `packages/chess/src/bosses/` or the
  boss screen. If the boss id isn't on main yet, gate the challenge on it existing (the intro and talk beat still work, the challenge
  waits) and say so.
- His paths in `e2e/areas.json`; `e2e/zebra-home.spec.ts` (walk in, the guards' look, through the door and back, the chatter, the talk
  beat); the area page (≤5 lines) and a decision note (≤10 lines).

## Deliver
Stills/GIF to orphan branch `stills/zebra-home` (phone and computer: outside, front, back, the talk beat). Push; PR title
"Rolling Dough: Don Dough's bakery (admins first)"; body (≤40 lines) to `.pr-body.md`; `.done` as the LAST push. Wait for green CI.
