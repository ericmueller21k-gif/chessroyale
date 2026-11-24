# Pre-game votes: label each vote box for a moment (Nov 25). Opus high, a MOCKUP (2-3 ideas, stills/GIFs). No merge from this job

Eric (Nov 25): "during the voting phase ... We need to maybe find a better way to show which ... of the votes are which. Maybe ... for like
3 seconds, let's put ... that 3D arrow that's on the floor in the battle tower. I almost want text like that ... it kind of hovers ... above
each one, and it should just say kind of what it is. Give me a mock-up ... it just flashes there ... a soft flash. I guess I don't want it to
be like too ugly and out of place though, the text. So maybe you can give me like a couple different ideas and just screenshots. Or if
there's like another way to just show like what the voting boxes are for a second. And then basically when you click ... when you
actually put your vote in, then they go away because you know what they are."

Start: `git fetch origin main && git checkout -B claude/vote-labels-mockup origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `docs/areas/match.md` (the Crowd mode's pre-game votes: how it starts, the clock; Duel's time-control zones in
`components/DuelVote.tsx`, `voteZoneBox`), and the Battle Tower's floor arrow (`town/shops/tower-floor-scene.ts`, `tower-floor-art.ts`
`floorArrow`: the gold 3D arrow drawn on the floor) for its look.

Mockup (a dev preview page or stills from the real vote screens with a test switch; phone and computer; light and dark):
- **2 or 3 ideas** for labelling each vote zone/box on the board for about 3 s as the vote begins, a soft fade in and out (a gentle pulse,
  not a hard blink), gone for you the moment you cast your vote. The same on every screen (each zone's label above that zone, on both
  sides' boards).
  - A: floor-arrow style lettering: chunky 3D gold text lying in perspective on the board above each zone, like the tower's floor arrow.
  - B: a clean floating tag/banner above each zone (the game's banner style), with a small pointer down to the zone.
  - C: your own idea (e.g. the zone itself lighting up in turn with its name in it, or the zone's icon growing with its name under it).
- Keep it readable at phone size and not "out of place": the game's fonts and colors.
- Deliver on orphan `stills/vote-labels-mockup`: for each idea a still on the phone and the computer at the label's peak, and a short GIF of
  its 3 s fade; `NOTE.md` (each idea, your pick, what it'd cost to build). Code on `claude/vote-labels-mockup`. `.done`, push, stop. Commits
  end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. Never images under docs/.
