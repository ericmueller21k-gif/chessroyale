# Crate opening overhaul: build it (Nov 24). Opus high, targeted lane (screens, animation, sound; no rolls or odds)

The mockup (branch `claude/crate-open-mockup`, d59369d6; media and `NOTE.md` on `stills/crate-open-mockup`) is approved. Read NOTE.md
first: it lists what the final version needs. Eric's picks (Nov 24):
- **Sound A, "card in the spokes"** (he picked the 4th video sent: Rare with A; also the director's and the mockup's recommendation).
- **Spin 4 s** (director's call from the mockup's recommendation; one setting, so Eric can change it).
- **The near-edge stop** (the reel creeps just past the winning tile's near edge and settles): kept, as in the mockup (picture only).
- **The winning box drops in** for the open (as in the mockup).
- **NEW, Eric (Nov 24): "when we open it on the phone now ... the full phone screen takes over, like literally ... the vertical ... using
  this blue and black background you have, I like that a lot. And then on desktop, it can take up that middle space, that full middle
  space."** On a phone the whole opening (spin, open, reveal card) is a full-screen layer over everything, edge to edge, top to bottom
  (safe areas respected for the buttons), on the mockup's blue-black background. On a computer it fills the whole middle column (the
  game's center area between the side columns), top to bottom, same background. Nothing under it shifts or unmounts; closing returns you
  exactly where you were.

Start: `git fetch origin main claude/crate-open-mockup && git checkout -B claude/crate-open-build origin/main`, then bring the mockup's
code in (merge or cherry-pick from `claude/crate-open-mockup`; the dev preview page may stay as the crate's preview). Read CLAUDE.md,
`.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/shop.md`, `docs/areas/accounts.md` (the reward card, the inventory layer).

1. Wire the new spin + open + reveal into every place a crate opens (the Crates tab, boss crates, the Welcome Crate, the reward card's
   crates, the Fischer Random/second-strip path as NOTE.md says), replacing today's reel and its marimba for crates only (Settings'
   "Reveal sound" for the move reveal keeps its voices). Rolls, odds, server calls and what's shown as won: unchanged.
2. Sounds A made ahead in the sound worker like the bosses' (no work on the opening's frames); the Legendary/Mythic ending as in the clips.
   Clicks scheduled on the audio clock (`clickTimes`). Spin length one setting (`CRATE_OPEN.spinMs: 4000`, Eric's words in its comment).
3. Set up the Web Animations while "Opening…" waits for the server (NOTE.md: the one long frame at the start). Reduced motion: no blur,
   shake or jolt, the beam a simple fade. Keep 60 fps on a 4x-slowed phone (measure once with the mockup's script; the drawing changed,
   so frame rate is measured per eric.md).
4. Prove: typecheck; unit tests touched; the crate e2e specs (shop, welcome-crate, xp-rewards or whichever open crates) updated, plus one
   focused check: the layer covers the full viewport on the phone and the full middle column on the computer, and closing leaves the
   screen under it as it was; watch an opening frame by frame once. Stills on orphan branch `stills/crate-open-build` (NEVER images in
   docs/): one phone full-screen sequence (spin, open, card) and one computer, plus a short MP4 with sound of a Legendary on the phone.
   Decision note (about five lines: Eric's picks, the full-screen call). Area page (shop.md). PR body in `.pr-body.md` (what changed,
   player-visible, changed checks old → new). `.done`, push, stop. Don't open PRs or wait on CI. Helpers reset, never revert. Commits end
   with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names). American
   English.

## Changed Nov 24 ~18:55: the sound (Eric)

Eric: "I am liking the sound, the paint, like the spinning sound of number 3 a bit better, but the number 4 ending sound and everything
else about number 4." (Video 3 = Legendary with sound C, the slot reel; video 4 = Rare with sound A.) So: **the spin's clicks are C's**
(the heavier metal tick, with its low swell under the slowdown and the reel's lock clunk) and **the ending is A's** (A's clean glassy
chord sting, and A's Legendary ending for Legendary/Mythic). Everything else as video 4 (the look). Send one short MP4 with sound of the
mix (Rare and Legendary) in the stills.
