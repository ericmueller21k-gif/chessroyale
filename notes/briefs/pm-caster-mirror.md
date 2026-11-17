# Phone casters: projectiles from a turned boss's hand. characters lane. Opus, high (rendering, every boss's power on a phone)

Branch `claude/pm-caster-mirror` from main. About 1 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/decisions/2026-11-17-boss-facing.md`
(#774, merged), `docs/areas/bosses.md` (facing).

**Why:** #774 turns 10 bosses to face the board in the phone's boss bar. Its PR left one place: the phone's casters at the board's
corner (`.pm-caster`), whose projectiles leave from a hand point measured on the unmirrored art (Babur's hoops, Chub's carrots,
Puddles' spray, and any other boss with a caster). Eric asked for every boss facing the right way, so this finishes it.

1. List each boss with a `.pm-caster` (or a phone power that throws from the figure): does it turn now, and where does each projectile
   start? Use the same mirror-aware point as the app's `figurePoint` (one shared helper, not per-boss offsets).
2. Fix so every projectile leaves the hand that's drawn, on a turned and an unturned boss alike. Watch each power frame by frame with
   real taps (`npm run frames:boss`), phone.
3. Tests: one focused check in an existing spec (e.g. boss-side or the boss's own spec) that a caster's first projectile starts within
   its hand on a phone, for the turned bosses; boss kit green. Targeted lane; list the specs.
4. Stills: one sheet on `stills/pm-caster-mirror` (never docs/): each caster's first frame, before and after.

Done: `.pr-body.md` (under 40 lines) and `.done`, end. Blocked on Eric only: `.question`. No PRs, no CI waits.
