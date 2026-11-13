# Hidden Boss music: wire his four themes (Nov 13)
You are the `god-king` helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: high (audio timing across a phase change).
Follow `.claude/agents/god-king.md`. Read CLAUDE.md, .claude/LESSONS.md, docs/areas/bosses.md. On branch claude/director-notes read
notes/hidden-boss-today.md (how his fight and phase change work today). The handoff is on branch stills/trailer-v2, commit 91a3f0b2,
folder boss-music/: README.md, section "The Hidden Boss (`recluse`)" is the spec (the table, the switching rules, the one timing that
must match). Questions about a length go to the music session, session_01JuCWRs7vACHciUbhC3eY8V (send_message), never by editing audio.

Copy: the six MP3s (recluse-house-loop, recluse-phase2-intro, recluse-phase2-loop, recluse-beaten-intro, recluse-phase3-intro,
recluse-phase3-loop) into packages/app/public/music/ exactly as they are (never re-encode), and the four theme entries (recluse-house,
recluse-phase2, recluse-beaten, recluse-phase3) from its themes.json into the app's themes.json (keep their "marks").
Build: switching from one theme to the next mid-fight, by theme key, with the fades the README gives (1.5 s; 0.3 s; phase 3 starts at
full level while the house loop fades over 0.5 s). No change to how a single theme plays (musicPlan, startPlan).

**Wire it to the fight as it is TODAY** (the child form, his room and the new cutscene aren't built yet):
1. The fight starts at his adult form (today's phase 1): play `recluse-phase2` from the start. (Later the child form plays
   `recluse-house` first; leave a clear hook, don't build it.)
2. His adult form beaten (the phase change begins): `recluse-beaten` at once (0.3 s fade of whatever plays). Its loop runs through his
   talk and the absorption.
3. The transformation starts: `recluse-phase3`. **The boards must split at transformation start + its `introSeconds` (19.293 s now),
   read from themes.json, never hard-coded.** Define the transformation's start that way (split time minus introSeconds) and check it
   lands on a sensible beat of today's phase change (about where he rises in his rage, after the God King is gone). If it lands too early
   or late to look right, the phase change's durations are settings (RECLUSE_PHASE2.change): adjust them within reason, or tell the music
   session the length you need (it re-renders in about 10 minutes) and say so in your report. `marks.pause` (16.631 s in) is a tick of
   silence and a book slam before the drop: line it up with the book in his hands if it's close; report where it lands.
4. The loop runs to the result, which plays as for any boss.
Online: his phase 1 can be met online (a crowd final); music is client-side, so the same switching applies there; phase 2 is solo only.

**Loading (director's call):** don't preload these four at town load (2.5 MB, a boss only admins meet). Fetch `recluse-phase2` when his
fight starts, and `recluse-beaten` and `recluse-phase3` right after, so they're ready before the phase change.

Testing: typecheck; unit tests for the switching (which theme when, the fades, the split time from introSeconds); the Hidden Boss's
e2e spec (`recluse.spec.ts`) and the boss kit. Measure in the game, with real taps, the gap between the drop and the split
(`npm run frames:boss`): within one frame. One still or short clip for Eric: the split with the timeline marked. About 2 hours.
Branch claude/hidden-boss-music (from origin/main). Push at each real step. Decision note at most 80 words; update docs/areas/bosses.md.
When done: push .pr-body.md (short), then .done last. Don't open a PR. American English. Never include model names in commits.
