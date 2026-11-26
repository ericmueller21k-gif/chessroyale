# Chandy's checkmate Dodge: the art (Nov 26). Opus high. Characters lane. Branch `claude/chandy-mate-art` from main.

You are the `characters` delegate (`.claude/agents/characters.md`). Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`,
`docs/areas/bosses.md` (Chandy), Chandy's sprite and animation code (`packages/app/src/characters/chandy*`, `components/Chandy.tsx`,
the existing Dodge view) and how other bosses' cinematic poses are built (e.g. Birdie's fall: `BIRDIE_CINEMATIC`).

**Eric, Nov 26:** when you checkmate Chandy, "instead of the game ending right away, it pauses and he jumps onto the center of the board
and collapses, and then he reaches his arm out though towards your king, and that's when he zaps it ... and then it starts [the Dodge]
... if you do succeed ... something a little extra too right before it ends, just clearly showing that you win." Chandy's Dodge also still
comes from his 5 upgrades as before; this art is for the checkmate way in.

A separate job (`god-king` delegate, branch `claude/chandy-mate-dodge`, brief `notes/briefs/chandy-mate-dodge.md` on
`claude/director-notes`) builds the rules, the pause and one exported timeline with beats: (1) the pause on your mate, (2) he jumps onto
the center and collapses, (3) reaches his arm toward your king, (4) the zap at your king, (5) his line, then the Dodge; after a survived
Dodge, (6) the win beat. It uses his existing poses as placeholders. Your job is the art those beats show.

**This job, phase 1 (stop after it for the director's review):**
1. A storyboard mockup first: one image, the beats 1-6 as panels over the real game screen (phone 390x844 and computer 1536x730),
   showing where he lands, his collapsed pose, the reaching arm toward the king, the zap, his speech box, and the win beat. The win beat:
   simple and clear, reusing what the game already has where it can (Eric, Oct 14: simple beats flashy; less code, less lag).
2. The new sprite poses in his pixel-art style, at his existing sprite size and palette: the jump (2-3 frames), the collapse (2-3
   frames, a slumped pose to hold), the reach (2 frames, arm extended toward a direction: make it work toward any side of the board, or
   mirrored), the zap (the arm's rifle/hand flash plus a bolt, reusing his beam's effect if it fits). Preview them with
   `npm run preview:characters -- <dir>` (GIFs and a sheet).
Push stills (the storyboard, the pose sheet, the GIFs) to branch `stills/chandy-mate-art` (never under docs/, no images committed under
docs/). Commit the pose art and its definitions on `claude/chandy-mate-art` (not wired to the timeline yet). Write a short `.pr-body.md`
draft (what's drawn, frames, sizes). Then commit and push an empty `.done-storyboard` and stop. Phase 2 (wiring the poses to the rules
job's timeline, frame-checking with `npm run frames:character`) comes as a separate brief after Eric sees the storyboard.

Budget: about an hour. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no
Co-Authored-By. American English.
