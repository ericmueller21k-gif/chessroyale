# Brief: the landing page's new demo reel (four short scenes, captions). Opus, high

Branch `claude/landing-reel` from origin/main (create it; `npm ci`). Read `CLAUDE.md`, `docs/rules/eric.md`, `.claude/LESSONS.md`,
`docs/areas/hub.md`, and include `notes/briefs/rules-common.md` (on `claude/director-notes`). Today's demo: `Landing.tsx` (`DemoVideo`),
`public/media/crowd-demo.{mp4,webm,jpg}`, made with `scripts/record-demo.ts` and `scripts/encode-demo.sh` (reuse both).

## Eric's words (Nov 11)
"In the HunChess landing page before logging in we have a dated recording of 50v50. I wanna update it with a [combo] which shows a
50v50 for 3-4 sec, running around the park in town for a few seconds, Big Boy and you standing across his board and then his
transition into the game vs him with a line about 'challenge bosses and unlock gear' or something better sounded. A ranked 1v1 clip,
and lastly an ominous figure aka hidden boss in all black sitting on a stool in the iconic [brooding chess] pose, with a caption like
'and the most powerful of them all'."

## Build
- **One looping reel** (the director's call: one video in today's slot, as today's MP4 + WebM + poster, not several GIFs: smaller and
  smoother on a phone), recorded from the real game on a phone viewport like today's demo, about 18–22 s, four scenes with a short
  crossfade or cut, **a caption per scene** (big, readable on a phone, in the game's font and colors, burned in or overlaid, your call:
  the simplest that stays crisp):
  1. **50 v 50**, 3–4 s, a live-looking crowd turn (the picks, the board). Caption e.g. "50 players. One board."
  2. **The town**, a few seconds running around the park; then **Big Boy's home: you and Big Boy across his board**, his challenge
     intro, and the cut into the battle against him. Caption e.g. "Explore the town. Challenge bosses. Unlock gear." (Better wording
     welcome: give Eric two options in your report.)
  3. **A ranked 1 v 1**, a few seconds of a real game with the ranked chrome showing. Caption e.g. "Climb the ranked ladder."
  4. **The Hidden Boss**: an ominous all-black silhouette sitting on a stool at a board, in the classic brooding pose (hunched over the
     board, chin resting on his fist, elbow on his knee or the table), a dim light, maybe a glint of eyes; a tiny loop (a breath, a
     glint). **A silhouette, not a likeness:** no face, no name, nothing that identifies any real person (the rules); draw it as pixel
     art in the game's style. Caption: "...and the most powerful of them all." Hold it long enough to read, then the loop restarts.
- Use test switches, bots and an admin's town in a local `wrangler dev` to stage it (the game's own screens, not mockups), except
  scene 4's silhouette.
- Size: the reel at most about 1.5 MB each format; poster from scene 1; `preload` and the precache as today (not precached). The
  landing's tagline and layout stay; the video keeps its box's size (nothing shifts).
- Update `e2e/landing.spec.ts`'s media check if a filename changes; the area page (≤5 lines); a decision note (≤10 lines).

## Deliver
The reel's frames as stills (one per scene) and the reel itself (MP4) to orphan branch `stills/landing-reel`. Push; PR title
"Landing: a new demo reel (50 v 50, the town and bosses, ranked, the Hidden Boss)"; body (≤40 lines) to `.pr-body.md`; `.done` LAST.
Wait for green CI.

## Eric, Nov 11 (later): the ranked scene
"For the ranked clip make it even a few seconds longer and shuffle through all the ranked symbols and names and add another line like 'become a grandmaster' or whatever the highest rank is. I trust your vision." (Director: the shuffle Wood → Transcendent, landing on Transcendent: "Become Transcendent.")

## Eric, Nov 11: the size
"Make it much bigger, on mobile it's as wide as we can go, on desktop it's also quite large, at least half the height or about half the screen height." (Phone: full width; computer: about 50vh tall.)
