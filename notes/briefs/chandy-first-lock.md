# Chandy: his first capture is always his first lock (Eric, Nov 16, playtesting live). Opus, xhigh, alone. QUEUED after the hearts job

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

## Tests and deliver
His rule tests (no lock before his first capture; the first capture always locked first and upgrades; a queen first), the parity
test, `e2e/chandy.spec.ts`'s lock check updated. `.pr-body.md` (changed checks old -> new), a short decision note, `.done`. No PRs,
no CI waits, no model names in commits. Push work in progress at each real step.
