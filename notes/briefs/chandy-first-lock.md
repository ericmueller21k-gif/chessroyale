# Chandy round 2 from Eric's playtest: his first capture is his first lock, and Dodge reworked (Eric, Nov 16). Opus, xhigh, alone. QUEUED after the hearts job

Effort xhigh (boss rules, the move/moment order, online parity). `god-king` delegate. Boss lane. New branch `claude/chandy-first-lock`
from main. Include `notes/briefs/rules-common.md`. Read `packages/chess/src/bosses/chandy.ts` (L1: `firstLockPick`, `taught`,
`firstLockMove`, the steering), `docs/areas/bosses.md` (Chandy), `.claude/LESSONS.md`.

## Eric's words (Nov 16, playing him live)
"It seems like he's marking my guys, but I said for the first mark it should be unique, where he marks the turn that he captures.
Like, so he, before he captures, he marks, and then he captures it to do the first, to upgrade the first time. So basically the first
piece of the game that he captures is always marked first."

## Today (live, ea23748)
From his 3rd move, as a turn begins, he locks a piece he could take and his engine is *steered* toward it (not forced). So his first
capture can be of an unlocked piece (an exchange on move 2, or the steer losing), and once `taught` the hunting locks start even if he
never took the first one: Eric sees marks before any capture, and a first capture that doesn't upgrade.

## The rule
- **No locks at all until his first capture.**
- **On the move where he first captures one of your pieces** (never the king; a queen too? the design says locks are never the queen:
  if his first capture is your queen, it still counts as the teaching lock and the upgrade: Eric's "the first piece of the game that
  he captures is always marked first"; note this call), the crosshair locks onto that piece **right before he takes it**, he points,
  then the capture lands: **upgrade 1** (the window). His move is his engine's own (no steering for this one).
- After that, the hunting locks as today (L1-L6).
- Solo and online the same (the server decides; the host's move then the lock moment before the move shows): the boss kit's parity.
- Remove `firstLockMove` and the steering of the first lock if dead. Re-run the sim once (one setting): the 5-upgrade and Dodge
  shares will move; report them in `reports/chandy-sim.md`.

## Dodge, reworked (Eric, Nov 16, after playing it)
Eric: "it should start out and his guys fire. They fire first ... and intentionally avoid the king. So there's an additional shot first
that you can't move or anything. And then ... it says a message ... dodge ... that way it's teaching you what you need to do ... you
have to get hit twice. So if you get hit once, your king put like a little crack through it ... if it gets hit again ... vaporize ...
the beam animation should be almost like dragged out ... a little bit of give in between each one ... they should actually start
moving from where his sprites are, and then they blast through ... and then they linger there ... Ours are red ... they should linger
for a few seconds after you dodge with your king, like even two to three seconds before the next one starts. And then if you do end up
dying ... keep the beams going for a few seconds on your king as it slowly particle dissipates away ... it keeps hitting it for like
5 seconds, and then you see the king cracking more, and we'll add a crackling sound, and then shards of your king go in all
directions, and then it goes to the you lose screen."
- **A warning volley first:** after the scope-in and the slide, before round 1, the clones fire once on lines that miss the king. No
  vote, no move. Then a line in the dock and over the board: "Dodge the next one!" (or better, short). Then the 3 voted rounds.
- **Two hits to lose:** the first hit cracks your king (a visible crack on its piece for the rest of Dodge) and play goes on; the
  second hit ends the battle. Rules and the server: count hits per Dodge (the last chance's Dodge too); one hit ends nothing.
- **The beams travel and linger:** each beam starts at its clone's muzzle and travels along its rank or file across the board (not
  appearing all at once), then holds as a steady, thick, red sustained beam (an original energy-beam look: no copying a famous
  attack's pose or effects) for about 2 to 3 s after the vote locks, before the next round starts. A little stagger between the
  four beams. Keep it on the one board-effects canvas; `@perf` it on a phone.
- **The kill:** on the second hit, the beams keep hitting the king for about 5 s: the cracks spread, it flickers and dissipates in
  particles, then it shatters into shards flying in all directions; then the result. On the first hit, a shorter version that
  leaves the crack.
- **Sounds:** a laser sound for the beams (Eric will have a proton laser mocked up: use a placeholder now and name the cue
  `chandyBeam`), a crack sound for the hit, a crackling loop for the kill and a shatter (cues `chandyCrack`, `chandyCrackle`,
  `chandyShatter`, placeholders).
- Dodge's whole length grows (a volley plus 3 rounds of vote, travel and hold): say the new total; the clock stays held throughout,
  online too. Update the sim's Dodge model for two hits (bots still find the safe square 60%).
- Stills and a GIF of a full Dodge (the volley, a dodge, a hit with the crack, the kill) on a phone to `stills/chandy-dodge2`.

## Tests and deliver
His rule tests (no lock before his first capture; the first capture always locked first and upgrades; a queen first), the parity
test, `e2e/chandy.spec.ts`'s lock check updated. `.pr-body.md` (changed checks old -> new), a short decision note, `.done`. No PRs,
no CI waits, no model names in commits. Push work in progress at each real step.
