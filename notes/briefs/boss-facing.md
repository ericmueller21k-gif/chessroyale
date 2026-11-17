# Every boss faces the right way, everywhere it stands. characters lane. Opus, high (rendering, every boss)

Branch `claude/boss-facing` from main. About 1-1.5 h. Read CLAUDE.md, `.claude/agents/characters.md`, `.claude/LESSONS.md`,
`docs/areas/bosses.md`, `docs/rules/eric.md`.

**Eric, Nov 17:** "Can we send a helper to have all the bosses facing the right way" (after Dash faced away from the board on a
computer; #766 fixed that one place).

**Where things are:** `BossCharacter.tsx` ~393 adds `.art-left` only for `place` "results" and "side" when `kit.artFacesLeft`
(kits.ts ~191; 9 kits set it, "judged by eye, Nov 8"); styles.css ~23337 mirrors the sprite about its feet. `data-faces` comes from
`drawnFacing` (sprite-kit.ts). Places: `bar` (phone's boss bar), `results`, `side` (computer, left of the board). Bosses are also
drawn elsewhere without BossCharacter's places (boss select's stage, home/Dash, intros and entrance cards, portraits in banners and
lines, the town if any): find them all.

**The job:**
1. A table: every boss × every place it's drawn (phone and computer), which way it faces as drawn, which way it should face. The rule:
   a boss faces the board it's playing on; on results, the God King; where there's no board or foe (select stage, home, portraits),
   toward the screen's middle (or as drawn if centered). Take one still per place with all bosses (a grid is fine), not per boss.
2. Fix with the least code: one rule from `drawnFacing`/`artFacesLeft` and the place's side, not per-boss exceptions. Re-check the
   9 hand-set `artFacesLeft` flags against the art (the measured facing from `drawnFacing` may make the flag unnecessary: if so,
   use it and drop the flag). Bubbles and words never mirror. Effects tied to a hand or side (projectiles, a slap at the clock,
   Dash's clock) must still land where they should when mirrored: check each boss's power moments in the mirrored places.
3. Tests: one focused check in an existing spec (e.g. boss-side or boss-select) that each place's boss faces its board/foe, for every
   boss; plus the boss kit stays green. Targeted lane: list the specs in the PR.
4. Stills for Eric at the end: one before/after grid per platform (phone, computer), on a `stills/boss-facing` branch, never under docs/.

**Note:** the Dash stall helper (claude/dash-stall) is adding Dash clock gags beside the board at the same time: don't touch
dash.ts's gag code; if both change BossCharacter's class line, keep it small so the merge is easy.

Done: push `.pr-body.md` (under 60 lines: what changed, player-visible, the table summarized, changed checks old → new, lane) and
`.done`, then end. Blocked on Eric only: push `.question`, end. No PRs, no CI waits.
