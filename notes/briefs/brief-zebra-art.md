# Brief: the zebra kingpin and his crew (art): a new boss's characters. Opus, high

Branch `claude/boss-art` (shared with another art session today, the bakery's: `git pull --no-rebase origin claude/boss-art`
before each push; never force-push). **Art only: no app code** (a code round wires it after Eric approves). Make the same files and
format the boss-art scripts make (`scripts/boss-art/`, `out/<name>/`: the `.ts` export, PNG sheets, GIFs at 3x, a summary).
Include `notes/briefs/rules-common.md` (read both with `git show origin/claude/director-notes:<path>`).

## Read first
- **Eric's words, word for word:** `notes/zebra-eric.md` on `claude/director-notes`. Follow them exactly; this brief only organizes.
- How a boss's art was delivered: `scripts/boss-art/out/boss-beaver/` + `timber-nov1.md` (every animation, the summary), and an
  intro's: `intro-timber-nov3.md`, `intro-grex-nov4.md` (exports, feet, cues, timeline, calls for Eric).
- **The look to match ("like the giraffes ... upright, like a human kind of stand"):** the shady dealer giraffe
  (`packages/app/src/characters/sidekicks/dealer.ts`) and Jefferson's art (`out/boss-grex`, `packages/app/src/characters/grex.ts`):
  their proportions, outline, shading and pixel scale. The zebras stand the same way and sit in the same world.

## Who they are
A mob that runs a bakery ("nothing here but a bakery, move along"); really, chess-obsessed nerds. The zebras are the giraffes'
rivals. Keep it light and silly: bread instead of guns, never real weapons, never a real person or a film's characters, quotes or
look. Working id **`zebra`**; his name is Eric's call (leave it out of the art).

## What to make
1. **The kingpin (the boss):** a zebra with a **big pudgy belly**, the boss of the operation (a mob-boss air mixed with a baker's:
   your call, e.g. pinstripe vest straining over the belly, flour-dusted, a pinky ring, a fedora or a baker's cap; Eric hasn't
   chosen, so make it funny and readable at game size). His **bread rifle**: a long French roll held two-handed like a rifle, with
   the scoring slashes along its crust so it reads as bread at a glance.
   - The standard boss set, as Timber's: idle, move, thinking, smug, rattled, hurt, check, capture, cheer, bigCheer, victory, defeat,
     entrance; a portrait (as the other bosses' portraits).
   - **`breadPop`** (his battle start, Eric's words): pulls out the roll, shoulders it like a rifle, "fires" at you (a tiny muzzle
     puff of flour/crumbs and a cue for a little *pop*), then laughs. About 2–3 s.
   - **`volley`** (his God King save, Eric's words: "he comes down ... firing off a bunch of shots with this loaf of bread"): a looping
     rapid fire, several puffs, the roll recoiling; funny but a good animation. Mark where the puffs leave the roll.
   - **`relax`** (the back room's talk beat): a calm-down wave of his hand to his crew.
   - Sitting at the table (the back room's chatter): `sitTalk` (talking, gesturing, poking the table), `sitListen`, `sitScoff` (he's
     always right: a smug correction pose).
2. **The crew: five zebras** (two door guards in the front room, three at the back table), one base drawing with variations (hats,
   shades, a toothpick, flat cap, vests, aprons, a scar or bandage...), each one recognizable. Animations:
   - guards: `guard` (standing, roll held across the chest), `watch` (head/eyes turning to follow the player: say how the code picks the
     direction);
   - table crew: `sitTalk`, `sitListen`, `sitArgue`;
   - all five: `draw` (standing, pulls the roll from the side and points it, Eric's talk beat), `aim` (holding the point), `lower`
     (relaxes, roll down), and a `puff` only if it stays clearly cartoon (Eric said "puffing a little bit"; a little steam/cigar puff
     is fine, nothing realistic: a call for Eric).
3. **Props and effects:** the bread rifle as its own sprite (for the guards and on the table); the muzzle puff (`INTRO_ZEBRA_PUFF`:
   flour/crumb burst frames); **the battle splash: loaves of bread** (Eric: "loaves of bread as the splash screen"; see how the other
   bosses' splashes are made and match their size).
4. **Cues** for the sound round: the pop, the volley, the laugh, the draw, the "relax".

## Deliver
Notes `scripts/boss-art/out/zebra-nov10.md` (exports, feet, every animation and its frames, cues, the calls for Eric). In `out/`:
`boss-zebra/` (the kingpin), `crew-zebra/` (the five), `zebra-props/`; GIFs at 3x of every new move, and one sheet
`zebra-sheet.png` with the kingpin and all five crew side by side next to the dealer giraffe for scale. Push early (the bakery's art
session uses your figures in its mockup: push the kingpin's and the crew's idle/guard/sit frames first, within the first hour, and say
so in a commit message). Finish with `.done` in `scripts/boss-art/out/zebra-art.done` as your LAST push. Reply with the head sha, the
image paths and the calls for Eric.
