# Season ladder page, every ranked mode (Nov 25). Opus high, `hub` lane, a MOCKUP (stills). No merge from this job

Eric (Nov 25): "a ladder board for all rank modes for the current season visible from the left panel on desktop and on mobile not sure
where the button belongs yet. But it's a nice clean page looking how you would imagine based, icon, name, record, etc."

Start: `git fetch origin main && git checkout -B claude/ladder-mockup origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md` (nothing hidden, nothing shifts; tabs/options greyed, not hidden), `docs/areas/hub.md` (the computer's left panel
`FrontMenu.tsx`, the phone's home and its menus, profiles `PlayerProfile.tsx` and its Ranked Standing card), `docs/areas/ranked.md`
(1 v 1 tiers, divisions, RP, placements, seasons; the emblems), and what 50 v 50 and Squads keep as rank/rating today (the profile's
"1v1 / 50 v 50 / Squads" menu; "Coming soon" where a mode has none yet).

First find out what exists: which ranked modes have a season standing stored (1 v 1 surely; 50 v 50's rating; Squads?), any leaderboard
query or endpoint already (grep `leaderboard`, `LeaderboardSheet.tsx` is the in-match one), and what a row can show from stored data.

Mockup (a dev preview page with made-up rows, or the real app with a test switch; phone 390 px and computer 1440 × 900; light and dark):
- **The page:** "Season 1" ladder, a tab per ranked mode (1 v 1 · 50 v 50 · Squads; a mode with no ladder yet greyed with its reason, never
  hidden). Each row: place, the player's small head (pawn + hat, as the in-match leaderboard), name, rank emblem + tier/division + RP (or
  the mode's rating), record (W-L, win %), maybe streak or games. Top 3 marked. **Your own row** always shown (pinned at the bottom when
  you're off the page, or "Unranked: play N placement games"). Tap a row → that player's profile. Clean and app-like; the game's fonts,
  colors and emblems. Scroll inside the list only; header and tabs fixed.
- **Ways in:** the computer's left panel: a "Ladder" entry (show it). The phone: **2 or 3 options** for the button's home (e.g. on the
  RANKED row/panel, the bottom menu, the profile's Ranked Standing card "See ladder"), each in a still, with your pick.
- Deliver on orphan `stills/ladder-mockup`: stills of the page (phone + computer, light + dark, one mode with your row pinned) and each
  phone way-in option; `NOTE.md`: the pick, what data exists vs what needs storing/indexing, the endpoint you'd add (paging, how it scales
  to tens of thousands of rows: an indexed query or a periodic snapshot), and the build cost. Code on `claude/ladder-mockup`. `.done`,
  push, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By).
  Never images under docs/.
- Effort: high (a new screen with data behind it; judgment on layout). About an hour.
