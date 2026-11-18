# Chandy: his boss bar's gap and his bird-chirp lock sound (Eric, Nov 18). Opus, high (characters lane)

Branch `claude/chandy-bar-chirp` from main. About 1 h. Read CLAUDE.md, `.claude/LESSONS.md`, `.claude/agents/characters.md`,
`docs/areas/bosses.md` (Chandy), `docs/decisions/2026-11-18-chandy-sounds.md`.

**Eric (Nov 18, a screenshot from his phone, dark mode, boss bar at move 2):** "Look at the size of this gator now, and look at how
all that stuff, his name and stuff, has moved too far to the right." And: "he makes like a squeak sound now. It sounds like a bird
chirping. He's a crocodile. Like it's got to do something different."

**1. The bar.** The director's captures (phone 428 wide, dark) show the same layout since Chandy went in (Nov 16): his frame is
`W + FIRE_ROOM` (`chandy.ts`, 56 px of room for his rifle held level, fully upgraded), and the bar sizes his slot by the whole frame,
so an empty gap sits between him and his name, and the name sits far right of every other boss's. Fix: in the bar (and anywhere else
his figure sits in a slot: the select tile, results, the town's challenge card), his name and meters sit where every other boss's
do; the rifle's room is only taken while the rifle is actually out (it may reach over the empty part of the bar, never over the
name), or the slot uses his figure's width with the room overflowing. Least code, and check Dash (the same "room" idea) stays right.
Also compare his figure's size in the bar with the other bosses' (Eric thinks he looks too big): match their height if he's off.
"Nothing hidden, nothing shifts" (CLAUDE.md): his name and meters must not move when the rifle comes out.
The bar's dark red-to-purple background is every boss's (not his): leave it.

**2. The chirp.** `chandy-sounds.ts` `lock` is two rising beeps at 1500-2250 Hz (a bird chirp), played when his scope locks a target
(about move 2); `unlock` is a falling 1800-1150 Hz beep. Redo both (and any other beep that high, e.g. the alarm/round if they
chirp) in his voice: low and heavy, pulse style (Eric: "pulse style sounds like predator too maybe"), not a copy of any film's sound:
e.g. a low throbbing electronic hum locking in (150-500 Hz), a soft click, a deep reptile growl or hiss under it. Keep each under a
move's loudness as the pack's test checks, and still distinct from the other bosses' sounds (`boss-sounds-own.test.ts`).

Checks: Chandy's unit tests, the sound tests, `e2e` specs for the boss bar/Chandy that cover it. Stills: the bar on a phone at
428 x 746 (dark and light) with the rifle stowed and out, next to another boss's bar, and a computer at 1280 x 800, on branch
`stills/chandy-bar`. Done: `.pr-body.md` (under 30 lines; describe each new sound in a line) and `.done`; push and end.
