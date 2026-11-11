# Brief: a soundtrack for the landing reel, two ways (samples for Eric). Effort as set

Repo checked out at `main`. Read `CLAUDE.md` and include `notes/briefs/rules-common.md` (on `claude/director-notes`). Your output branch is
named in your session; deliver on an orphan branch (below), nothing merged into the game yet.

## Eric (Nov 11)
He wants a little sound in the game, starting with the landing page's reel (muted by default; the toggle turns sound on). Sounds made by
code (our synthesized boss sounds) have worked well; AI-generated audio (ElevenLabs) hasn't. "Is there [a way to] actually use real
software, like music software, and create music from that software?" He wants something "epic", light and fun like the game.

## Make: two ~25 s tracks, each timed to the reel
The reel (PR #628, branch `claude/landing-reel`: `packages/app/public/media/hunchess-reel.mp4` 25.3 s and `hunchess-reel-wide.mp4` 25.4 s;
scene times from `scripts/encode-demo.sh` / `scripts/reel/`): 1. 50 v 50 (energy, a build), 2. the town (lighter, playful) into Big Boy's
challenge and battle (a hit as the battle opens), 3. ranked (a rising run as the ranks shuffle up to Transcendent, a flash/stinger on
it), 4. the Hidden Boss (drop to something dark and low, a held note, silence-ish under "…and the most powerful of them all"), then it
loops cleanly back to the start (the last bar leads into the first).
1. **Chiptune**, synthesized in code the way `packages/app/src/characters/*-sounds.ts` and `synth.ts` make sounds (square/pulse/triangle
   /noise voices, written note by note): a little 8/16-bit theme.
2. **Real instruments from written notes**: compose it as MIDI (in code), render it with real music software and a free sampled-instrument
   library: e.g. FluidSynth (`apt-get install fluidsynth`) with a soundfont whose license allows a commercial game (e.g. GeneralUser GS,
   FluidR3_GM (MIT), MuseScore_General (MIT): check and cite the license; no AI audio). Strings, brass, timpani, a choir pad: "epic" but
   light. Mix and master to a sane loudness (about -16 LUFS), no clipping.
Both: original melodies (never a known tune), the same scene timing, loop-clean, a short text of what you wrote and how (tempo, key, the
instruments, the license).

## Deliver
Orphan branch named in your brief's session (`stills/reel-music` for the Opus run, `stills/reel-music-fable` for Fable): each track as
`.ogg` and `.mp3`, and each muxed onto the phone reel as an `.mp4` to watch with sound (`<name>-with-reel.mp4`), plus `NOTES.md`. Push,
and reply with the paths and two lines on each track. No PR.
