# Brief: catching selective cheating (bursts against a player's own baseline). DESIGN first. Fable, xhigh

Branch `claude/fairplay-bursts` from origin/main (create it). Read `CLAUDE.md`, `docs/areas/fairplay.md` (all of it: strength, hard
finds against the crowd, timing, streaks, evidence, the deep re-check, levels, the engine pool), `docs/history/fairplay.md`, the code in
`packages/server/src/fairplay*.ts` and `packages/core/src/fairplay*.ts`, the cheater simulations, and include
`notes/briefs/rules-common.md` (on `claude/director-notes`). Another helper is changing the same area right now on
`claude/fairplay-near-best` (near-best moves count as the engine's best; one clear deep-checked match pools; a sustained-strength path:
the average match strength over the last 4-5 matches): read its brief `notes/briefs/brief-fairplay-near-best.md`, build on it, and
don't edit those files until it merges (this round is design; code comes after).

## Eric (Nov 11, word for word, lightly cleaned)
"Another thing we need to be wary of is there are people who cheat at very ominous times. They will play normal, but ... this is the
more common thing in chess, they don't just cheat every move ... we need to know what their typical average Elo is, like how they
actually play, and this would apply to every player, even if they played 50 matches. And we need to see if, sometimes, we notice spikes
that are consistent in their skill, and there's a pattern where they're playing at a level, all of a sudden for 4 or 5 moves they're
playing at 3,000 Elo, and there's a pattern of that for more than just a game or two, that's a mega must-notify, and drop them in the
same cheater queue, because that's really the biggest way people cheat and get away with it: the subtle cheating. There may be better
ways for us to capture that. You could look at how it's done in other realms."

## This round: research and a design (no code in the app)
1. **What's already measured** that bears on it (hard finds against the crowd, timing, streaks, critical moments) and what's missing.
2. **How others do it**, from public sources only (Lichess's published anti-cheat work, e.g. its open-source Irwin/Kaladin and its
   blog; Chess.com's published fair-play explanations; Regan's published work on move-matching and intrinsic ratings; and any game's
   public write-ups on behavioral baselines). Cite links; no guessing about private systems.
3. **The design** for HunChess, as simple as it can be and cheap to run (players' devices first, the server's deep re-check only when
   needed, per CLAUDE.md's computing priorities): each player's **baseline** (their usual strength, from all their kept matches, robust
   to bad games), **bursts** (short runs of counted moves well above that baseline and above an absolute level, weighted toward hard
   and critical positions), and the **pattern** across matches that notifies Eric (Discord alert) and pools. What the review page shows
   (the bursts, highlighted moves). How it behaves in Crowd (a pick per team turn), 1 v 1 and Squads. The data it needs (anything new
   stored is the full lane: say so). False positives: a strong player having a great streak, a player improving, opening theory
   (book moves never count), forced moves.
4. **How we'd prove it** with the cheater simulations: a "selective" cheater (engine moves only in N critical positions a game, or for
   bursts of 4-5 moves) is caught within a few matches; honest strong and improving humans (Maia 1500-2600, drawn) aren't; report the
   catch and false-pool rates you'd target.

## Deliver
`docs/ideas/fairplay-bursts.md` (the design, ≤ 2 pages, plain words, the build plan in steps with each step's lane), pushed to the branch;
`.done` LAST. Reply with a 10-line summary for Eric: what we'd catch, how, the false-positive guard, and what the build costs.
