# The Stranger, polish round (Eric, Nov 27 ~22:40 UTC, after playing him in the tower). Fable, high. Boss lane

Read `notes/briefs/rules-common.md` first, then `notes/briefs/stranger-storm-art.md` (everything Eric said about the storm),
`notes/briefs/tower-entrances-bigboy-line.md` part 1 (his elevator entrance: do it in this job), `docs/areas/bosses.md` (the Stranger)
and `.claude/LESSONS.md` (above all: watch every board, move or animation change frame by frame with real taps, `npm run frames:boss`).
Branch `claude/stranger-polish` from `origin/main`.

Eric, playing him on a phone: "right when he triggered his ult, it showed the tornado before he even initiated anything, before he even
jumped down on the board, for a split second around the board. ... when he stuck his swords into the board ... the whole thing looked
clunky. It should be: he sticks them in and the cracks start growing, and while they grow the tornado around the board kind of just
appeared at once. It should have a startup animation where it builds more and more. ... look at it from when he starts, look at the
banner and look at every frame and make sure it looks fluid and it's a clean animation, because right now it looks clunky, like a second
thought, last minute. ... I had said dimming everything, and it still isn't dark. Even the scoreboard underneath ... everything should get
a little dulled, so it's more of a focus on the board during those 3 turns. ... the crack is too distracting, so make it 50% opacity."
Also: "he kind of hops down [on mobile], and it almost looked like his size shrunk a bit." And: "when you beat him, it should have that
same blue pop-up style we use for other things, and say the Stranger is now available in Boss Battle, something like that."
1. **Frame by frame, the whole ult** from the banner to the first storm turn, phone and computer (`scripts/frames-stranger-storm.mjs`,
   real speed and slowed): list every glitch in the decision note, then fix each.
   - Nothing of the storm shows before his leap (the ring flashing early is a bug: find why: a first frame before `scene` is set, the
     canvas drawn at full strength for a frame, a prewarm painting it).
   - The ring BUILDS: from nothing as the first sword goes in, growing with the cracks (a few wisps, then a thin ring, then the full
     storm by his grip), never popping in at once. The rift tears out in step with it (the drawn opening).
   - Every beat flows into the next (leap, plant, plant, charge, pull, back to his corner): no snaps, jumps or frozen frames.
2. **His size when he hops down on a phone:** compare his figure's on-screen pixel size in his corner and on the board (the leap, the
   storm scene, the finishers); make them match (or scale smoothly in the jump), so he never looks shrunk.
3. **The dim:** during the storm's 3 turns everything but the board dims clearly (about 45-55% darker: the page, the boss strip, the
   move list and scoreboard under the board, the side panels), the board itself not dimmed, with the storm over it. Eased in and out.
   Taps still work on everything (the dim never blocks input).
4. **The rift at 50% opacity** (its stages and its opening), so it reads but doesn't distract.
5. **Unlocked pop-up:** when you beat him on a tower floor and he unlocks (`boss_unlocks` written), the game's blue pop-up (the same
   style the game already uses for such notices; find it) says "The Stranger is now available in Boss Battle" (button: OK; another to go
   to Boss Battle if the existing notices offer one). Once.
6. **His elevator entrance** on his tower floors (the brief above, part 1).
Tests: one focused check each in the existing stranger spec (no ring before his leap: the ring's strength 0 then rising; the dim on the
move list; the rift's opacity; the unlock pop-up once). Show Eric: a GIF of the whole ult on a phone (real speed) and of the entrance,
on orphan `stills/stranger-polish`, then write `.mockup` and wait for the director's `.go` before the PR (`timeout 590 bash -c 'until git
fetch -q origin claude/stranger-polish && git cat-file -e FETCH_HEAD:.go; do sleep 30; done'`). `.pr-body.md` (at most 40 lines),
decision note, area pages, `.done`. Commits end only with your Claude-Session line.
