# Crate opening overhaul: a MOCKUP and sound options (Nov 24). Opus high. No merge to main from this job

Eric (Nov 24): "we got to redo like the spinning for when we open a crate ... keep all the logic the same ... I want it to also sound more
like ... a playing card being ... moved through the spoke of a wheel ... right now it's like that marimba ... a little too silly sounding.
... redo just the quality of it ... feel a little more exciting ... maybe it's even just like a graphic overhaul on it. ... send me ...
a few 2 or 3 second clips, or ... 5 second clips, basically like the sound opening sequence. ... add ... like a Rocket League style, where
... when it opens up, it has another like opening animation. Maybe we use that same light that we've built now for a few things ...
the color of the light is related to the quality of the item." He also mentioned "maybe we use the API usage for this": paid art from the
art runner is fine if new pictures are needed, but ASK the director before any spend (the director asks Eric).

Start: `git fetch origin main && git checkout -B claude/crate-open-mockup origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `docs/areas/shop.md` (crates, the reel, the reveal), the crate-opening code (`screens/Crates.tsx`, the reel, its
sounds in `sound.ts`: `REEL_VOICES`, the marimba), and find "the light we've built" used in several places (search the app for the light
beam/rays effect used in reveals, entrances or the town; name the one you reuse).

Deliver, all on branch `claude/crate-open-mockup` and orphan stills branch `stills/crate-open-mockup` (never on main, never images in docs/):
1. **Sound options: 3 clips, each 3 to 5 s**, of the whole opening sequence (the spin's ticks slowing to a stop, then the reveal), as MP3
   (also WAV), made with the game's own synth approach (code, like `sound.ts`/`synthBuffer`; no outside samples unless licensed and
   recorded in LICENSES.md):
   - A **"card in the spokes"**: a stiff paper/plastic flap clicking against spokes, fast then slowing with the reel, a little rattle,
     then a clean reveal sting;
   - B **prize-wheel ratchet**: a plastic clicker on pegs, slowing, a final "thunk", then the sting;
   - C a **heavier mechanical tick** (slot-machine reel) with a rising swell under the slowdown, then the sting.
   For each, also a short legendary-tier ending (a bigger sting) as a separate 1 to 2 s clip. Name the files plainly.
2. **The look: a mockup** of the overhauled spin and the new open, as a dev preview page (like the other `dev/*-preview` pages) plus
   GIFs/stills (phone first, one computer):
   - the spin with more quality and excitement (depth, the center line glowing, motion blur at speed, a satisfying slowdown and
     settle, the winning item's tile lifting);
   - then a Rocket League-style open: the crate (its existing art) drops in or shakes, the lid bursts, and **a beam of light in the item's
     rarity color** (reuse the existing light effect) shoots up, then the item rises into the reveal;
   - one GIF per rarity color (common to the top tier), using the rarity colors the game already has.
   Keep every roll, odd and server call unchanged: this is presentation only. Frame rate on a phone matters (simple beats flashy: prefer
   CSS transforms and the existing effect over a new frame loop).
3. A short `NOTE.md` on the stills branch: what each clip and GIF shows, what new art (if any) a final version would need with an estimated
   art-runner cost, and your recommendation. Then `.done` on `claude/crate-open-mockup`, push, stop. No PR. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names). American English.
