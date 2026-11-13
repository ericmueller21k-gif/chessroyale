# The Hidden Boss's child form (Eric, Nov 12-13)

Effort xhigh (boss brain and strength, a new form in the match). **Boss lane** (the boss kit applies: `packages/chess/test/boss-kit.test.ts`,
`e2e/boss-smoke.spec.ts`; one quick review pass follows). Branch `claude/recluse-child-form` from main. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/areas/bosses.md`, and on branch `claude/director-notes`: `notes/hidden-boss-today.md`, `notes/briefs/hidden-boss-house-NOTES.md`
("Update 3", "Eric's answers", "Nov 13: Eric's test kit").

## Build
- **A new first form, the child**, before today's adult form, solo and online. No powers; kid's lines (short, his voice as a boy; never
  his name anywhere).
- **Strength ramps:** Maia from about 1800 for the first moves, +100 Elo every 4 moves (all moves) up to Maia's cap (check it). Use the
  existing Maia box (`packages/maia-worker`, `/engine/maia/`). His level beside him rises with a level-up at each step.
- **He grows:** the ages already drawn (`recluse-ages.ts`: 9, 13, 20, the age-20 black suit) step up as his level rises, the last
  matching the adult form. A growing step (reuse an existing effect: simple beats flashy).
- **Music:** the recluse-house theme in this form (`themes.json`, `recluseMusic`); the adult form's theme after it, with the existing
  fades.
- **Beating the child form** → a new match starts (reset) against the adult form, as Eric described.
- **The team's move online** is the party rule already in use (`partyMove`).
- **The admin 🏆 "Win this form"** works in the child form (solo and online).

## Parallel jobs (Eric lifted one-at-a-time for the Hidden Boss)
Running at the same time: **online phase change + four boards** (`claude/recluse-online-phase2`: owns the server, protocol, lobby and
the online phase sequence; it adds a form list in settings so the child can go first) and **the cutscene** (`claude/recluse-cutscene`,
app only). You own the child form's content: brain strength, sprites and growing, lines, music, and the solo wiring. For the online
wiring, keep to the form list and the existing match flow; if the online job's form list isn't on main yet, wire solo first, merge
`origin/main` often, and wire online once it lands (say so in the PR body). Small, separate commits.

## Tests
The boss kit; unit tests for the ramp (Elo by move number, the cap) and the form order; e2e: a solo fight's child form (the growing
steps, 🏆 → the adult form starts). Typecheck. `npm run frames:boss` on the growing step (Eric's rule: watch it frame by frame). List
changed checks (old → new). Push work in progress at each real step; write `.pr-body.md`, push `.done` and stop. Don't open PRs or wait
on CI. No model names in commits. Never stop silently.
