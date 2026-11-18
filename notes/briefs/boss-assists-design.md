# Boss Assists: a new mode, design only (Eric, Nov 18). Opus, high (design that must match the code); docs only, no code

Branch `claude/boss-assists-design` from main. About 1.5-2 h. Read CLAUDE.md, `docs/rules/eric.md`, `docs/areas/bosses.md`,
`docs/areas/autochess.md` (where it sits), `docs/areas/matchmaking.md`, `docs/areas/fairplay.md`, `packages/chess/src/bosses/base.ts`
(BossRules) and each boss's header comment in `packages/chess/src/bosses/*.ts` (its powers, how each picks, when each lands).

**Eric's words and calls (Nov 18):**
- "a game mode where each player chooses 3 bosses and is able to use their moves during the game as 'assists'"; then: "To make it
  easiest, bosses are randomly chosen 3 per side, some moves like you said we just simply don't include in this mode. I'd say it's 2
  normal moves and then 1 ultimate assigned at start. It would not replace any mode we would shove it next to autochess."
- "every tile on the board marked as open, closed, pass through but can't land, totally blocked, etc. things would also overlap which
  gets chaotic, but that's sorta the idea."
- "Each player would get a meter that builds that allows them to use moves"; "nothing is selectable ... it picks the same way it does today".

**Director's calls (write them as calls, each with its reason, for Eric's OK):** each side's 3 random bosses give one assist each:
two of them a normal move, the third its ultimate (which boss gives the ultimate: random); a player plays a human opponent (1 v 1,
like Auto Chess's matchmaking), bots fill if nobody comes; a move that spends the boss's whole turn, plays a move for him, or is a
character's cinematic (Moo's Full Moon, Chandy's Dodge, the Hidden Boss) is left out of the mode.

**Write `docs/decisions/2026-11-18-boss-assists-design.md` (and a short `docs/areas/boss-assists.md` stub):**
1. **The assist list:** every boss (all of `BOSS_ROSTER`, admins-first too): its normal moves and ultimate, each marked in / out of
   the mode, with one line why; what each does when cast by a player against the other (the two-way version: who casts, who's hit);
   when it lands (e.g. as the opponent's turn begins), how long it lasts. Keep only moves that work with no target picked.
2. **The board layer** (Eric's idea): one shared state per square (open; no landing; no landing or passing through; a wall a knight
   jumps; ...) and per piece (frozen, shielded, held, ...); how each kept move writes into it; how overlaps combine (the most
   restrictive wins; the "always a legal move" lift in one place); which existing bosses' rules would move onto it, and how to do that
   without changing any boss battle's behavior (the boss kit and its tests as the guard). Note that this layer alone is worth doing.
3. **The mode:** the start (the 3 bosses and the 3 assists shown, a reveal), the meter (proposals: how it fills, the cost of a normal
   move and of the ultimate, a cap), the three buttons (greyed until affordable: nothing hidden), timing so two assists never animate
   at once, the end, its place next to Auto Chess on home.
4. **Online and fair play:** the server runs every assist (seeded picks, same everywhere); what the protocol carries; how assist
   turns count for fair play.
5. **The build plan:** PRs in order, each with its lane and size; the layer first. And the open calls for Eric, one line each.

Use the code as it is: name the functions, files and settings each part touches. No code, no stills (a mockup of the assist bar is
welcome as one still on `stills/boss-assists` if it helps). Done: `.pr-body.md` (under 30 lines) and `.done`; push and end.
