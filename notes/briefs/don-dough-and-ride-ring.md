# Don Dough fixes + no destination ring on a ride (Eric, Nov 27 ~20:00 UTC). Opus, high. Targeted (town + one boss's display)

Read `notes/briefs/rules-common.md` first, then `docs/areas/bosses.md` (Don Dough, `zebra`), `docs/areas/town-square.md` (Rolling
Dough's back room, rides, the destination ring) and `.claude/LESSONS.md`. Branch `claude/don-dough-fixes` from `origin/main`.
1. **The back room (town):** Eric: "look in the back room of Don [Dough] ... his head gets covered up. He's not actually drawn behind the
   table the way he should be, so you can't even see him." Fix the draw order / his placement so Don sits behind his table with his head
   and shoulders fully visible over it (the table in front of his body, never over his head), from every camera spot in the room.
   Stills before/after.
2. **His timers in the battle (desktop):** Eric's screenshot: the small timer (a pawn icon and "04:00") sits up by the boss strip.
   On a computer, move it to the **bottom left of the board, sitting right in front of him**, and **a bit bigger**. The phone layout
   stays as it is unless it breaks (say if you touch it). Nothing hidden, nothing shifts (CLAUDE.md).
3. **Count every turn (all of his timers, global):** Eric: "right now it counts down 2 at a time ... only on his turn. So it goes from
   8 to 6. It should go 8 and then to 7 to 6 on each turn." Show the count dropping by 1 on every turn (yours and his). Keep the same
   total length (when a timer fires must not change): this is the display stepping per turn, not a rules change. If the rules count
   only his turns underneath, show the per-turn count derived from it and prove the firing turn is unchanged (unit test).
4. **Its tick sound 30% quieter** (Eric: "that sound ... is great, but just make it a little quieter ... drop it about 30%").
5. **No destination ring on a ride (town):** Eric: "if you're on a rider, you should not have, every time I press an arrow, a little
   circle in front of me where I'm running to ... only when we're not on anything." The gold destination ring (town-square.md) shows
   only on foot; on any ride, never (arrows, taps, the map's walk-to).
Tests: one focused check each in existing specs (the ring absent on a ride; the timer's place on a computer and its count stepping by 1;
Don visible in the back room). Boss kit for the zebra. `.pr-body.md` (at most 40 lines; changed checks old → new), a short decision
note, the area pages, then `.done`. Stills on `stills/don-dough-fixes` only. Commits end only with your Claude-Session line.
