# The Stranger's storm, redrawn: a real fire-and-ice storm, not pixel confetti (Eric, Nov 27 ~16:50 UTC). Boss lane; art first

Read `notes/briefs/rules-common.md` first, then `docs/areas/bosses.md` (the Stranger, "His storm") and `.claude/LESSONS.md`.
Branch `claude/stranger-storm-art` from `origin/main`. Eric asked for this to be drawn by a Fable helper (you).

**Eric, seeing the live ring (`StormRing` in `components/Stranger.tsx`: square pixel particles, orange and blue, scattered round the
board):** "I hope this is a joke... Does this look like... confetti. I'm talking about a realistic blend of shards of fire and ice
tornado... obviously, we can't actually achieve it to look like this, but do you see the difference here?... maybe we do go with this
dual look like Gemini kind of thought of. Maybe that's actually easier to do anyway... We need like a Fable draw on this... especially
once it's drawn, it should be a fairly quick loop, even if it's like a fancier animation... it shouldn't be causing frame drops if
it's just sort of like a layover kind of thing, like a GIF basically, right?"

**His reference (an AI image; described here, not shared):** the board framed by the storm. The LEFT half is fire: tall, realistic
licking flames (yellow-white cores, orange, deep red edges) curling up the left edge and across the top-left, embers and sparks
drifting off, a warm glow on the board's edge. The RIGHT half is ice: frost and blue-white swirling wind, translucent crystal shards,
icicles hanging from the top-right and bottom-right edges, cold mist and snow specks. The two meet top and bottom, swirling like one
tornado. In the middle a jagged crack across the board, glowing lava-orange on the fire side and icy blue on the other, with a few
floating chips of board (that's the opening scene's crack; the ring is the lasting part). Painterly, glowing, soft, smooth: the
opposite of square pixels. The board and its pieces stay readable under it (the flames sit on the frame and margins, only reaching a
little over the outer squares, see-through there).

**What to build**
1. **Mockup first, for Eric:** the ring as a looping animation over a real phone screenshot of a Stranger battle (and a computer one),
   as a GIF (`node scripts/frames-stranger-storm.mjs` has the harness). Its look: the dual fire-left / ice-right storm above, swirling
   (the flames and frost wind circling, shards whipping round), a 2-4 s seamless loop. During the storm's turns the active element
   leads (fire turn: the fire side brighter and reaching further; ice turn: the frost does), the other still there. Push the stills
   and the GIF to an orphan `stills/stranger-storm-art` branch and write `.mockup` with the paths, then wait for the director's go
   (`timeout 590 bash -c 'until git fetch -q origin claude/stranger-storm-art && git cat-file -e FETCH_HEAD:.go; do sleep 30; done'`,
   repeated) before wiring. The director shows Eric.
2. **Drawn once, played like a GIF** (Eric's point, and "simple beats flashy" at run time): render the loop's frames ahead, offline
   (a script, as rich as you like: many layered flames, noise, blur, glow, at the quality of the reference) into a shipped asset:
   an animated WebP or a sprite sheet (WebP/PNG) that Safari and Chrome both play with transparency. At play time nothing is drawn
   per particle: one image layer (or one canvas blitting a frame) over the board. Keep the asset small (aim under ~1.5 MB total; lower
   resolution scaled up is fine for glow and flames), loaded when a Stranger battle starts, not at boot.
3. Replace `StormRing`'s particles with it (keep its timing: when the ring rises, strengthens with `u`, the charge's wilder moment,
   fades). The opening scene's crack can take the same look (lava-orange on one side, ice-blue on the other) if it's cheap; say so if not.
4. Frame rate: the `@perf` boss specs on a phone (`npx playwright test --grep @perf --project phone`), the storm's frames no worse than
   today's ring. One focused check in the existing stranger spec that the ring shows during the storm (not a new spec).
Boss lane: the boss kit, one quick review by a fresh helper after (the director starts it). `.pr-body.md` (at most 40 lines, changed
checks old → new), a short decision note, `docs/areas/bosses.md`'s storm lines, `.done`. Commits end only with your Claude-Session
line; no model names. Stills only on the orphan stills branch; never images under docs/.
