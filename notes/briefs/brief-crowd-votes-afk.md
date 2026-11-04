# Brief: 50 v 50: a big majority always wins, the AFK rule, and the chat bubble removed (Opus high)

Worktree `/home/user/cr-crowdafk`, branch `claude/crowd-votes-afk`, from main. Set it up with `git worktree add` + `npm ci` (never a
node_modules symlink). Push as you go. Ports: 8991, inspector 9491. Include notes/briefs/rules-common.md. Rules change: the PR
gets `full-e2e`; record each call in `docs/decisions/2026-11-04-crowd-votes-afk.md`, and add the rules to `docs/rules/eric.md`
with guard checks.

Eric (Nov 4, playing 50 v 50 on his phone; "the recent changes make it feel much better"):

## 1. A big majority always wins
Today the played move is drawn from the top 3 by their picks (`crowdPlayedFromTop` 3, `crowdTopOdds` in `packages/core/src/scoring.ts`,
`drawMove`'s "popular" branch): 7-2-1 plays the 7 only 70% of the time. Eric: "if 85% of people play one move it always picks it,
even if it's a blunder… 10 people on white, a 7-2-1 split, the 7 should always win, but a 6-3-1 could go to the 3."
- New setting in the crowd settings: `crowdSureShare: 0.7`. When the most-picked move has at least that share of the team's picks,
  it's played, always (a blunder too). Below it, the draw as today (6-3-1: 60/30/10).
- The share counts real picks only (not the AFK defaults below).
- Unit tests: 7-2-1 → always the 7 (many seeds); 85% → always; 6-3-1 → the 3 sometimes; ties as today.

## 2. The AFK rule (new)
Eric: "no move at all = default to a random top 5 move, but your penalty is simply you get the lowest score given to a player on
your team that round; but if you miss more than 3 moves in the game you are removed for being AFK, so people don't cleverly abuse
AFK if they don't know a move and it's nearing the end."
- A player on a team who picks nothing in a round gets a pick made for them: a random one of the engine's top 5 moves for that
  position. **That default doesn't count in the team's tally** (it would sway or dilute the vote; the director's call, in the
  decision note). If nobody on the team picked, the team plays a random top-5 move (check today's behavior and keep whichever
  matches this).
- Their score that round is **the lowest score any teammate who picked got that round** (instead of today's miss penalty: find it,
  `missedMoveScore` / `missCaps` and the crowd's miss rules in `settings.ts`, and replace it for 50 v 50). Can't be gamed: it's never
  better than the worst real pick.
- **More than 3 misses in one game (the 4th) and they're removed for being AFK**: out of the match, off the team's voters, a clear
  line for them ("Removed for being away: you missed 4 moves.") and in the chat/feed for others if the game shows such events.
  Removed players don't rejoin that game; say what happens to their rewards/points (they keep nothing for that game unless today's
  leaving rules say otherwise: follow today's "left the match" path).
- Show the player when they've missed (e.g. "Missed: a move was picked for you (1 of 3)") so it's never a surprise.
- Bots never miss on purpose; make sure the rule doesn't hit bots.
- Unit + e2e: a miss scores the team's lowest; a 4th miss removes; the default never counts in the tally.

## 3. Delete the chat bubble over the board
The "new-message bubble" (`ChatBubble` in `components/QuickChat.tsx`, rendered from `App.tsx` ~1728; settings "New-message bubble"
and the chat options' "Show new messages as a bubble while chat is hidden"; prefs `chatBubbles`) shows the newest message as a
dark pill above the board ("Luft Lou 👏"). Eric: "delete it, chat stays in the chat box below, not above the board, never
approved that." Remove it everywhere (all modes), its two toggles and the pref; chat shows only in the chat box/tab. Update the
tests that used it.

## Done
Typecheck; the unit and e2e tests you change or add pass (under the lock). Stills of the miss line and the removal on a phone.
PR body `docs/crowd-votes-afk/pr-body.md` (every player-visible change and text, changed checks old → new, lane full-e2e). Push;
no PR. Short report.
