# Power tips: a short boss/God King exchange the first time you see a move (Nov 24). Opus high, targeted lane. A PILOT of 5

Eric (Nov 24, abridged; his words): "for the first time Birdie does his normal move, the king needs to say [something] ... we need lines
for kind of like explaining briefly ... once per game, and then honestly I think we can flag it where it's like per account ... the
first time you play Hollow, for example, your king should have a line ... or Hollow says something. ... it says it once always the first
time, but then maybe it comes up again in a game or two, and then maybe in like 5 or 6 games, and then after that just every like 5 games
against that boss, so you don't really see it too often. But we can keep that pattern strict for all the bosses ... just like one number.
... the boss can just say something to the king, and the king can respond. ... I definitely don't think we want that every game ... start
with ... 5 and I'll just play and see how those actually feel ... Maybe part of the fun is that you're not quite sure what the move is
... But the worst case scenario would be just like you're not having fun because you don't know what's going on."

Model/effort: Opus `high` (a schedule kept per account, the speech queue, solo and online screens); Eric suggested Haiku, but CLAUDE.md
puts logic on Opus. Lane: targeted (no server data: kept per account on this device, like the replay's coach marks in `move-replay.ts`).

Start: `git fetch origin main && git checkout -B claude/power-tips origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`,
`docs/areas/god-king.md`, `docs/areas/bosses.md`, `packages/app/src/godKing.ts`, `packages/app/src/speech.tsx` (the shared speaker rules),
`packages/app/src/move-replay.ts` (per account on this device: `coachDue`/`coachDone`), and how Chandy's Lock-on Shot warning (#915,
`shotQueen`/`shotRook` in godKing.ts and Boss.tsx) is wired, as the pattern for a power moment the God King speaks on.

1. **One table** (`packages/app/src/power-tips.ts`): each tip is `{ boss, power, trigger, lines }`: the boss id, a short power key, the
   power event that triggers it (the first such event in a battle), and an exchange of 1 to 3 lines, each `{ who: "boss" | "king", text }`.
   Adding a tip later = adding one row. No other file should need to change for a new tip of an existing event kind.
2. **When it shows** (one rule for every boss, numbers in `packages/core/src/settings.ts`, e.g. `POWER_TIPS: { at: [1, 3, 8], every: 5 }`,
   Eric's words in its comment): count, per account on this device, the battles in which that power was seen (a battle counts once, when
   the trigger first fires). The tip plays in that battle if the count is 1, 3, 8, then every 5 after (13, 18, ...). Once per battle at
   most. Guests count on this device too. Counting key: the account id (or "guest") + boss + power. Storage in try/catch; a broken store
   shows the tip (better to explain than not).
3. **How it shows:** through the existing speech bubbles: the boss's line in the boss's bubble, then the God King's reply in his, in order,
   at the critical priority, as the moment shows (after the power's own banner/animation start, never covering the board's warning
   markers). It replaces the God King's ordinary line for that same moment on that battle (no double talk). Solo and online, Boss alone
   and group battles (each player's own device decides). A test switch `?tip=all` shows every tip every time (for stills and e2e).
4. **The 5 pilot tips** (director's draft; plain American English; keep each line short):
   - **Birdie, the Train** (his first warning): Birdie: "All aboard! Clear the tracks!" King: "See the yellow sign? Move that piece. His
     train only hits the one under the sign."
   - **Hollow, the Dark** (his first dark square): Hollow: "Don't forget what's there..." King: "It's only dark. The piece is still on that
     square. Remember where it was!"
   - **Sawyer, the Split Pawn** (the split): Sawyer: "Measure once, cut twice!" King: "He sawed his pawn in two. Now he has an extra one."
   - **Chandy, Lock-on** (the first lock after his two taught captures, `lockOn` not `first`): Chandy: "Target acquired." King: "A crosshair
     means he's hunting that piece. Each one he takes upgrades his rifle. Keep it safe!"
   - **Boingo, the Pie** (his first pie): Boingo: "Pie in your face!" King: "Nobody can step on the splattered squares for a while. And two
     splats on the same piece freezes it!"
   Check each line against the power's real rule (the FAQ text in `faq/content.ts`) and fix any word that's wrong; keep each line's length.
   Never write the Hidden Boss's name.
5. Prove: typecheck; a unit test of the schedule (1, 3, 8, 13, 18 show; 2, 4-7, 9-12 don't; once per battle) and of the table (every tip's
   boss and trigger exist); one e2e check in an existing spec: with `?tip=all` against Birdie, the boss's tip line then the king's show as
   the first warning comes, and without the switch on a second battle (count 2) they don't. Stills on a new orphan branch
   `stills/power-tips`: each of the 5 exchanges on the phone (the board visible), one computer still. Decision note of about five lines
   (the schedule, per account on this device, the replace-the-ordinary-line call). Area pages (god-king.md, bosses.md). FAQ: one line that
   the boss or the God King explains a move the first few times you meet it. PR body in `.pr-body.md` (what changed, player-visible,
   changed checks old → new). Then `.done`, push, stop. Don't open PRs or wait on CI. Helpers reset, never revert. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names). American English.
