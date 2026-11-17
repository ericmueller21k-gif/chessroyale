# Moo & Moon: the Full Moon cinematic. characters + god-king lanes. Opus, high (art via the API runner, animation, timing)

Branch `claude/moo-cinematic` from main. Read CLAUDE.md, `.claude/agents/characters.md` and `god-king.md`, `.claude/LESSONS.md`,
`docs/areas/bosses.md` (Moo & Moon row: Full Moon, `fullMoonMs`, `swap`, `poweredKit`, `moo-state.ts`), `docs/rules/eric.md`.
Art is drawn by the paid API runner (branch `claude/boss-art`, `scripts/boss-art/run.ts`, Opus, key BOSS_LINES_API_KEY), never by
hand. API cap: $8 for phase 1, $25 in all. Log each run's cost.

**Eric, Nov 17 (word for word):** "For moo and moons ult let's add an animation where the game pauses, he jumps down onto the center
of the board, then the board and everything above it like the boss bar, is replaced with a singular cinematic drawing of a field of
grass with a starry night and a giant moon taking up a big chunk of the sky, then it does this cool view switch where it shows a super
close up of moo and moon from a side profile angle staring up at the moon (you can't see it in this part but you can see a glistening
radiating in their direction) their eyes start turning white, then it goes back to the first scene and this is where he does the
transformation, then the background fades and then once it fades he hops back to his spot. Can use api creds for this, send me stills
of what the 2 angles would look like, lmk if you have questions about it"

## Phase 1: the two stills, then STOP for Eric (about 45 min)
- **Scene A (wide):** one drawing in the game's pixel-art style and Moo's palette: a grass field at night, a starry sky, a giant moon
  filling a big part of the sky. Sized to cover the board and everything above it (boss bar included) on a phone (390 px wide) and on
  a computer (the board column). Moo & Moon stand on the grass in the middle (his existing sprite, drawn on top, not baked in).
- **Scene B (close-up):** Moo and Moon in side profile, huge in frame, looking up toward the moon (off frame); a glistening light
  radiating onto them from that direction. Two frames: eyes normal, eyes turned white (glowing).
- Send: push stills to branch `stills/moo-cinematic` (never under docs/): A on phone, A on computer, B normal, B white eyes. Then push
  `.question` on your branch: "Stills ready on stills/moo-cinematic: OK to build?" with any questions, and END. The director shows Eric.

## Phase 2 (only after the director passes on Eric's OK): the sequence
1. The Full Moon begins on his turn (as now: `afterCrowdMove`, while he thinks), so no clock runs for the crowd: lengthen his think to
   the cinematic's length (`fullMoonMs`, settings.ts) rather than adding a pause. Online raids and solo the same; the server's timing
   matches (check moo-lobby tests). Target about 7-8 s total; every beat's length a setting.
2. Beats: he hops from his spot to the board's center (reuse his hop/jump frames) → Scene A fades in over the board and everything
   above it (board, boss bar; not the move list or clocks below on phone; say what you chose on computer) → cut to Scene B, eyes
   whiten → back to Scene A, his existing transformation (`swap`, the Moon swell) plays there → Scene A fades out → he hops back. The
   flurry and the powered moves follow as now.
3. Simple beats flashy: two images plus his existing sprite and moments; CSS fades; no new engine. Light on a phone (`@perf` frame
   budget, `npm run frames:moo`). Watch it frame by frame with real taps.
4. Tests: one focused addition to `e2e/moo.spec.ts` (the scenes show and clear, the board returns, the turn goes on) and
   `moo-wired.test.ts` (beat lengths add up to `fullMoonMs`); boss kit green. Boss lane.

**Note:** another helper (claude/boss-facing) may change BossCharacter's facing (class line, styles.css `.art-left`) at the same time:
keep your BossCharacter changes small and separate.

Done: push `.pr-body.md` (under 60 lines) and `.done`, end. No PRs, no CI waits.
