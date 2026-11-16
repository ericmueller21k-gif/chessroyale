# Chandy's home: the swamp, its room, the challenge's rising platform and his intro (Eric, Nov 16). Mockup first, then build

Effort high (town art, room drawing, animation and timing; Opus). You are the `characters` delegate (`.claude/agents/characters.md`);
the town's room code is the town-square area's (`docs/areas/town-square.md`: "Inside a shop", "Challenging a boss", "Adding a home",
"The street town", the Walk-up's open-sky rooms). Boss lane. New branch `claude/chandy-home` **from `origin/claude/boss-chandy`**
(Chandy's art, PR #736, not merged yet: pull main into your branch once it is). Stills to `stills/chandy-home`. Include
`notes/briefs/rules-common.md` (on `claude/director-notes`). Read `.claude/LESSONS.md` and CLAUDE.md ("Simple beats flashy", "Nothing
hidden, nothing shifts", phones first). Chandy is in no roster yet (his rules are the next job): his home shows in **an admin's town
only**, as Timber's and Dash's did first (`BOSS_ADMIN_FIRST`, `ADMIN_TOWN`), and its challenge can run his battle once his rules land
(until then, say how the challenge is stubbed or greyed: "Nothing hidden": greyed, never missing).

## Eric's words (Nov 16)
"Let's build up. So his house, it's just going to be a swamp, but in order for it to kind of still fall in line with the other houses,
we'll just put some brush, like some trees around it that are roughly the same height of the buildings, and then the middle will be a
swamp. And when you actually enter, it'll basically just it won't actually be like a house then. So there will be the ceiling or
whatever would actually be the sky, whatever time of day is calculated, just like for the outside world. And pretty much just what
you'd think. It's just a swamp. And when you run in there, though, the bottom of your pond is covered, and then the ground below you
kind of splashes through the water, if that's not too difficult to try to program in. And for the battle, you can't actually see where
it is, but underneath it, there's going to be a platform. And so same thing, like shopkeeper in the back. So like everything is in the
water. Like the shopkeeper stand is kind of like a foot in the water. But then anyway, when you do the actual match, then like you
would go to your spot, because the game knows obviously where you would stand. But when you stand there, Yeah, the platform or like
the it like rises up. It could just be like something made of like wood, you know, or like mossy covered. I don't know. It doesn't
really matter. But when it rises, actually first, [...] make the chessboard actually rise up first. because if it rises up first,
then it can, the math can be like it rises because it'll need to come up since it's a bit more vertical than the rest. And then that
comes up from the water, but obviously like the bottom of it would still be in the water because it's touching the platform, and then
the rest of it rises up with the, [...] for the stools, they could just be like, you know, [...] milk crates or something, something
that would be found in the water. his animation coming into the fight. The full screen can just be, you know, swamp themed, or I
don't think we need to be crazy with it."

## What to make
1. **The front in the town:** a plot ringed with brush and trees about as tall as the other buildings (so the street's skyline stays
   even), a swamp in the middle (water, reeds, lily pads, a few cypress knees), a sign and a way in like any home. Original art.
2. **The room:** no building inside: **the sky overhead follows the town's time of day** (`sky.ts` `skyNow`, `roomLight`, `?sky=`, as
   the Walk-up's rooms). The floor is shallow swamp water everywhere. **Walking in it:** the water hides your feet (a waterline across
   the legs) and small splashes kick up as you move (cheap: a few pixels of spray per step on the room's one canvas, no new loop).
   **The shopkeeper's stand** at the back, its legs in the water, selling Chandy's Boss Crate as every home's does (who keeps the shop
   is a call: a swamp animal, original; give Eric two options in the README). Say what a crate needs that isn't there yet (crates are
   the item-builder's lane: flag it, don't build items).
3. **The challenge:** you and Chandy walk to your marks (in the water: the platform is hidden under it). Then, in order:
   (a) **the chessboard rises first** out of the water on its stand (it's taller, so it starts first), water streaming off, its foot
   still in the water; (b) **the platform rises** under you both, wood with moss, lifting you, the board's foot meeting it; (c) **milk
   crates** as the stools, on the platform. Then his entrance animation into the fight (his God King attack swing as every boss), and
   **a full-screen wipe, swamp-themed and simple** (water rising over the screen, reeds or ripples; not crazy).
4. **Sounds:** cues only (water slosh steps, the rise, the wipe), with placeholders from existing packs, as #736 did.

## Mockup first
Stills: the front in the street (phone and computer), the room by day and by night (phone), a walking GIF with the splashes and the
waterline, the challenge's rise as a GIF (board, then platform, crates, his entrance) and the wipe's first frames. About 8 images and
2 GIFs. Push to `stills/chandy-home` with a README (what's drawn, the calls for Eric, frame cost on a phone), write `.mockup` (content
"home round 1") to `claude/chandy-home`, and wait in one foreground Bash call
(`timeout 590 bash -c 'until git fetch -q origin claude/chandy-home && git show origin/claude/chandy-home:.go 2>/dev/null | grep -q home; do sleep 30; done'`,
repeated, up to 3 hours) for the director's `.go` ("home redo" = another round with notes; "home build" = build it).

## On build
Pull main. The home and room in the game (admin's town only), the challenge's rise as an intro timeline (`shops/intros/<boss>.ts`,
`shops/timeline.ts`: the data way), the wipe, the splash. Tests: the area's existing kind (the home's art test, the intro's beat log,
the room by time of day), the town's specs it touches, `@perf` (the drawing changes: `npx playwright test --grep @perf --project phone`
under the shared e2e lock). Watch it frame by frame with real taps. Add its paths to `e2e/areas.json`. Update `docs/areas/town-square.md`,
a short decision note, `.pr-body.md` (what changed, player-visible, checks old -> new), then `.done`. No PRs, no CI waits, no images
under docs/, no model names in commits (end with the Claude-Session line only). Push work in progress at each real step.
