# Birdie's Station inside: longer crossing arms, and the bar's birds (Nov 26). Opus high. Branch `claude/birdie-room-birds` from main.

Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/town-square.md`, and the room's code:
`packages/app/src/town/shops/birdie-art.ts`, `birdie-lobby-art.ts`, `ShopRoom.tsx`, `intros/birdie.ts`, `sidekick-sheets.ts`
(`birdiebartender`). Today's town lesson (#969, `docs/decisions/2026-11-26-town-lights-uploads.md`): anything drawn the first time
it's seen uploads mid-walk and hitches; bake every picture at load and keep it. Eric: "we want easier code and less lag over all else".

**Eric, Nov 26 (his words, lightly trimmed):**
1. "the railroad like crossings that come down, we need those things to be bigger. They're supposed to be like, much longer than that.
   The ones that are on each side of the challenge area in his place. So they should be up like high towards the ceiling, and then when
   they come down more."
2. "I want like 50 birds at the bar, like they're clearly like, and they're all nibbling on bird feed, and it's like a cycle ... make sure
   it's kind of programmed in a way where it's not like ... actually a lot of like just reuse like the same stuff, and it should be,
   these birds that are on a kind of a fixed script where when they all like fly, kind of keep flying back and forth onto the bar, and
   the bartender keeps scooping up more bird feed or food and putting it on the bar around it, and then they nibble on it. So there's
   just like 50 birds scattered around on the table, some sitting on the chairs that jump up on the table, and then they fly away ...
   if you run up to the bar, then they all fly away, and then they don't come back for a little bit ... they fly up into the ceiling
   and kind of disappear like onto the left and right of the room, and then when they start gradually like flying back in."

**Build:**
1. The crossing arms: much longer, raised high toward the ceiling, coming down further when the battle starts (their lights flash as
   now). Same art style, just longer.
2. About 50 small birds (mourning doves and sparrows in the room's pixel style; a few color variants from ONE small sprite set: idle,
   peck, hop, fly 2-3 frames each), all from one sheet baked at load. A fixed, looping script (seeded, no per-frame randomness that
   costs): birds perch on the bar and the stools, peck at seed piles, hop from a stool up to the bar, fly off up and out of frame to the
   left and right of the ceiling, and drift back in a few at a time. The bartender (the existing sidekick) loops a scoop: scoops seed and
   sprinkles it on the bar, and the birds nearest a new pile peck at it.
3. When your figure comes near the bar (a radius, a setting), every bird scatters up and out; none come back for a while (a setting,
   e.g. 20-30 s), then they return gradually. Every number in `packages/core/src/settings.ts` (or the town's settings) so it's tunable.
4. Cost: one draw batch for the birds, no new uploads while walking (the town's upload guard `e2e/town-street.spec.ts` style: add a
   focused check that walking into Birdie's room and up to the bar uploads nothing new), frame time measured with the town's `?report`
   inside the room on the phone project before and after (put both numbers in the PR body). If 50 costs real frame time on a slow phone,
   say so with numbers and propose the count; don't silently drop it.

**Process:** first a quick mockup (one still of the room with the longer arms and the birds placed, phone 390x844 and computer 1536x730)
pushed to branch `stills/birdie-room-birds`, then commit and push an empty `.done-mock` and keep building (don't wait). Finish with a short
GIF (the birds' loop and the scatter) and two stills in the same stills branch (never under docs/). `.pr-body.md` (what, player-visible,
numbers, checks changed old → new), a 5-line decision note, `docs/areas/town-square.md`. Light/targeted lane (town art and a loop): the
town specs you touch. About 1.5-2 hours. At the end commit and push `.pr-body.md` and an empty `.done`, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no Co-Authored-By. American English.
