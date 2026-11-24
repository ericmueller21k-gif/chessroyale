# Crate opening: each rarity its own sound, and "Fischer Random" renamed Transcendent with a new tile (Nov 24). Opus high

Eric (Nov 24, after approving the no-charge mix): "can we make other sounds for the different rarities as well? We can just keep like common
and uncommon the same, but like rare and whatever goes up should each have their own with the Fisher random. ... maybe it's just time to
change the Fisher random name ... what's our highest rank? Is it Transcendent ... switch the name to that. And then maybe we do away with
the little king with the question mark and we actually make a cooler looking crate in its place."

Base: `claude/crate-open-build` (PR #922, the approved sound: C's ticks, A's ending, NO swell and NO charge: keep those out). If #922 has
merged, start from origin/main; else from that branch (`git checkout -B claude/crate-tier-stings origin/claude/crate-open-build`).

**Step 1 (do this first, then STOP and push): audio only, for Eric's OK.** Eric wants to hear before more time goes in.
- Common and Uncommon keep today's sting (one shared). **Rare, Epic, Legendary, Mythic each get their own distinct ending**, clearly
  climbing in excitement, all in the same family as A's glassy chord (no build-up/charge before the burst; the burst itself may differ):
  e.g. Rare a brighter chord with a little shimmer; Epic a fuller chord with a rising arpeggio after the burst; Legendary a big chord with a
  choir and a bell; Mythic the biggest, its own color (a second chord change or a sparkle cascade). Also a short **Transcendent** reveal
  sound for the moment the strip lands on the Transcendent tile (today's Fischer Random banner), distinct from the rest.
- Render audio-only WAV + MP3 with the build's own pieces (`renderCues` in `crate-open/sounds.ts`; the director rendered with a small tsx
  script calling `timeline()`, `clickTimes(T.spinMs, 390, STRIPS.crate.land)`, `cues()` and `renderCues()`): one full opening per tier
  (common, rare, epic, legendary, mythic) and the Transcendent moment alone. Push them to orphan branch `stills/crate-tier-stings`
  (`audio/`), commit the code WIP on `claude/crate-tier-stings`, write `.question` with "audio ready", push, and STOP (end your turn). The
  director will message you with Eric's answer.

**Step 2 (after the director's go):** wire the approved stings; rename "Fischer Random" to **"Transcendent"** everywhere a player reads it
in the crates (the strip's tile, the banner, the odds panel, the FAQ, the reveal; code names like `FISCHER` may stay). It is NOT the chess
variant: leave any "Fischer Random"/Chess960 start option in votes.ts and elsewhere untouched. The tile's picture (director's call, Nov 24): the strip's boxes are code-drawn SVGs (`components/Items.tsx` `SupplyBoxArt`,
`HunchessBoxArt`; today's tile is `FischerArt`, a gold crown with a "?"), so the Transcendent tile is a new SVG crate in the same flat
style and outline as `SupplyBoxArt` (a pixel sprite from the art runner would clash with them): a special crate, prismatic/iridescent
(a shifting rainbow-pearl gradient on its panels, a bright star or gem emblem, a soft glow and two or three sparkles), reading clearly at
the strip's tile size and in the banner. Replace `FischerArt` with it wherever that tile shows. Eric approved up to $5 of art spend; not
needed for this, so none is spent. Stills of the tile (strip, banner, odds panel) for Eric. Tests,
decision note, area pages, PR body, `.done` as usual. Never images under docs/. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By, no model names).
