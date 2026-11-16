# Design: a rank of its own for 50 v 50 and for Squads. Opus, high (design, no code). Read-only

About 1-1.5 h. Read CLAUDE.md, `.claude/agents/ranked.md`, `docs/areas/ranked.md` (1 v 1's ranks: tiers, RP, placements, seasons,
`RANKED_1V1`, `ranked.ts`, D1 tables), `docs/areas/crowd.md`, `docs/areas/squads.md`, `docs/areas/accounts.md`, ROADMAP.md item 4,
`packages/app/src/public-profile.ts` (the Ranked Standing card's 1v1 / 50 v 50 / Squads menu: "50 v 50 and Squads have no ranks of
their own yet"), and today's decisions `docs/decisions/2026-11-16-party-ranked.md`.

**Eric, Nov 16:** "It's always ranked. There is no unranked unless it's a private lobby. When you play a 50v50 or squads it also counts
toward your rank for that mode"; "each has their own rank in profile". Today: a 50 v 50 moves the hidden crowd rating (from moves), no
tier or RP; Squads is unranked (placements, coins, crates only).

**Write `notes/designs/mode-ranks.md`** on `claude/director-notes`-independent orphan branch `design/mode-ranks` (one page or two):
1. What exists that each mode can reuse (1 v 1's tiers, RP, placements, the profile card, the D1 shape) and what each lacks.
2. A proposal per mode: what moves RP (a 50 v 50: the team result and/or your placement or move quality; Squads: the squad's placement
   of 8), placements, how a party's members and leavers count, bots and the ranked share (`rankedShare`), seasons alike.
3. Stored data: new tables or columns, migrations, backfill (or none), what the profile reads.
4. The build in steps (which lanes, which effort, full lane where stored data), and the risks.
5. **Questions only Eric can answer**, few and plain, each with a recommended default.
No code changes. Commits end with the `Claude-Session:` line only, no model names. Push and end your turn.
