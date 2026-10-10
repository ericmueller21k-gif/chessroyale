# History: The engine and the judge

The decisions behind this area, moved here word for word from `DECISIONS.md` on Oct 10, 2026 (the housekeeping pass),
in the order they were made. This is the record of why. For how it works today, read [the area page](../areas/engine.md).

## The engine server: a hybrid (Oct 5, 2026)

Eric agreed the judge must be strong and put the account on Workers Paid. He asked about cost if the game got popular, and whether players' computers could help.

- **Hybrid, not "the server does everything".** Players' devices still do the routine scoring, as before. The server re-checks only the close calls that decide cuts. Lichess's fishnet is the precedent for using players' machines; the catch, cheating, is handled by never letting a device's number decide a close call.
- **The server:** native Stockfish 17.1 (the full network) in a Cloudflare Container (`engine/Dockerfile`, `standard-2`: 1 vCPU, 6 GiB). One shared instance, asleep after 3 idle minutes, woken when someone joins a lobby or starts a solo game.
  - Measured: about 700k nodes/s on one core. A re-check (the best move plus up to 3 disputed picks, 2M nodes) takes about 3 s at depth ~30. With 8 boards (Classic), the depth is shared (at least 400k each), so a round stays a few seconds.
- **Online:** the lobby Durable Object re-checks the host's close calls on the server before the lobby uses them, so the server's numbers decide. The host's phone skips its own re-check only when the server answered its wake-up ping.
- The lobby remembers "the server answered" in memory only; if the lobby object sleeps and wakes mid-match, the host's own re-check is used until the next player joins (safe, rare during an active match).
- **Solo:** re-checks go to `POST /api/engine/score` first, falling back to the device's own re-check (lite at 700k nodes).
- **Cost:** Cloudflare's published rates are $5/month plus usage. A cap of 3000 re-checks a day (`ENGINE_DAILY_SEARCHES`) keeps the worst case around $25/month; past it, devices' numbers stand. A whole-match-on-server design would have been about 3.5¢ a match (memory while awake); the hybrid is well under 1¢.
- **Later, if traffic grows:** cache analysed positions (crowd games share their openings), spot-check devices' numbers against the server, and run more instances.
- **Verified locally:** with the container running under `wrangler dev`, an online Classic match made 17 server re-checks (0.6–3 s), and solo games 35 (median 1.2 s).

## The re-check of close calls (Oct 5, 2026)

The top-8 search gives each move about an eighth of 250k nodes, which is why close calls are noisy (`reports/judge-accuracy.md`).

- Picked moves that lose 5–60 points are searched again, the most picked first (up to 3), together with the best move, in one search restricted to them: 700k nodes on a device, 2M on the server. Those numbers replace the first ones.
- The range goes up to 60 so a sacrifice the quick search called a blunder gets a second look. If a rechecked move beats the best, it becomes the best.
- In the simulation (`judge-cuts.ts`), re-checking roughly halves the strong players cut unfairly with a device's engine, and the server-grade version cuts it about 7 times.

## Brilliant moves (Oct 5, 2026)

- A move is brilliant when, among at least 6 picks, the moves within 1.5 points of the best were found by at most 20% of the pickers, and everyone else gave away 8+ points on average (`brilliance` in `core/scoring.ts`).
- **Never with a power-up** (Eric): a power-up shows the engine's top moves, so those picks are flagged (`usedPowerUp` on the round's results, sent online too) and never count. The reveal still shows the move, noting that a power-up pick doesn't count.
- The reveal shows "‼ Brilliant move: Nxf7 · only 3 of 40 found it", in brighter colours if you found it.

## Many judges (Oct 8, 2026)

Eric approved: online scores must be trustworthy (a modified browser could fake them, and one host did all the work),
before ranked opens. Built by the `engine` delegate. Numbers: `reports/judge-determinism.md` and
`reports/many-judges.md`.

**How it works**
- **A speed check on joining.** Each app times one 150k-node search (`UciEngine.speed`) and tells the lobby
  (`speed`). An app that never says (an old tab) is never a judge.
- **Two judges per board.** As a round starts, the lobby draws each board's two judges at random, weighted by speed
  cubed (a computer is drawn far more often than a phone), the costliest boards first, a device's weight dropping with
  each job it already has. The judges search the position while players think (the prefetch, as the host did).
- **The job names nobody:** the position, the people's picks (sorted, one per picker), the bots' skills and a seed. A
  judge runs exactly the host's old searches (`runJudgeJob`) and sends back the engines' raw output. The lobby works the
  board out from it with the same code (`judgedBoard`): the best move, every score, and the bots' picks, drawn from the
  seed (so two honest devices pick the same bot moves, and a report that doesn't follow from its own numbers is caught
  on its own: a strike).
- **The engine is deterministic,** so two honest answers are identical, not just close. Measured on 201 realistic jobs
  (498 searches, the device's own re-check included): identical on two separate engine processes, on a "used" engine
  that had just searched elsewhere and played a boss move, and in a Web Worker in Chromium. The build has no
  relaxed-SIMD instructions, the one WebAssembly feature that may differ between CPUs. So the lobby demands an exact
  match (`JUDGES.tolerance` 0). Not tested: a real ARM phone; any platform difference would show at once in the logs
  as honest devices disagreeing.
- **Agree:** used. **Disagree:** the engine server scores every move either judge scored at its deep node count, and
  its numbers are used. Blame: a third device gets the same job (a second opinion, which holds nothing up); the judge it
  doesn't match exactly gets a strike. Without a third device, the judge further from the verdict on the disputed moves
  is struck if it's further by `JUDGES.blameMargin` (4) points. Two strikes: no more jobs that match (and no more
  hosting). Every disagreement, strike and fallback is logged.
- **Never slower.** After the first answer the lobby waits `graceMs` (150 ms) or a quarter of the first's time for the
  second, then uses the first alone. The late answer is still compared when it comes; a disagreement is then settled
  for blame (the third device, the server). A device with a strike is never trusted alone. A judge that drops is
  replaced; a job whose second judge never answers gets a spot check on the server 25% of the time
  (`spotCheckShare`), blamed only past 50 points (`soloBlame`, above the worst honest difference measured, 47.5:
  a phone's quick search and the server's deep one can differ that much on a sharp move).
- **No engine server** (down, out of budget): the judges re-check close calls themselves (checked like the rest), and a
  dispute waits up to 5 s for the third device: two of three decide. No third device: the judge with fewer strikes,
  then the faster, stands (as the host's did), and the logs say so.
- **Close calls get depth, wider.** Picks by players within 25 points of the cut line (each team's line in 50 v 50)
  are re-checked first, from 1 point of loss (`recheckCutLoss`, `recheckCutMax` 5, `recheckCutPoints`), on top of the
  usual ones; any tie in which moves to re-check is now broken by the move, so every device and the server choose
  alike. With judges the re-check goes to the engine server once the judges agree; it applies to the host's path too.
- **Unchanged:** solo, bot-only rounds, a lobby with one device that can judge (the host scores, as before), boss moves
  (the host). `JUDGES.on = false` turns it all off. Nothing on screen changed.

**Tested against liars** (`packages/sim/scripts/many-judges.ts`: the real lobby logic, whole Crowd matches, real
Stockfish, simulated time; cheaters claim 3M nodes/s to be drawn as often as possible; 2 matches per scenario, each
also played the old way):

| Scenario | Cheater's gain, old way (points) | With judges | Cheater benched at round | Honest devices struck |
|---|---:|---:|---|---:|
| Scores its own pick as the best | 364 | 0 | 4, 3 | 0 |
| Random noise on every score | (noise, not a gain) | 0 | 2, 2 | 0 |
| Every move as good as the best | 88 | 0 | 2, 2 | 0 |
| Answers from a 5k-node search | 15 | 0 | 2, 3 | 0 |
| Inflater, with dropping and slow phones | 364 | 0 | 6, 3 | 0 |
| Inflater, engine server down | 581 | 0 | 4, 3 | 0 |
| Only two devices: a fast inflater and an honest phone | 213 | 23 | 10, 11 | 0 |

- Scores matched the honest devices exactly on every job two honest judges settled (none moved, 0.0 points), and the
  rest used the engine server's verdict or two of three devices. Every cheater was benched in every match; no honest
  device was ever struck.
- The one gap: with only two devices, a fast cheater's answer is used alone when its honest partner is a slower phone,
  until it's caught (its first lie is caught when the phone's answer comes). Seven such jobs in two matches, 23 points
  in all (the old way: 213).
- **Timing** (lock to reveal, simulated): with two computers judging, the same as the old way (median 287 ms); with a
  computer and a phone, 150 ms more (437 ms, the grace); the 95th percentile is the server's re-check either way
  (about 3.4 s). `graceMs` 0 makes it never slower at all, at the price of relying on the late comparison.
- **Engine server calls:** about the same as before: 15–20 per Crowd match (mostly close calls before cuts, the
  widened set included), plus about 2 verdicts per cheater per match and the odd spot check.

**Left, or for the director**
- *Proposal (a visible change, so not built):* when a late answer shows the one used was a lie, correct that round's
  scores before the next cut. That would close the two-device gap above.
- Two cheaters colluding (both drawn for the same job, both lying the same way) would agree and pass; random draws make
  it rare with many devices, and spot checks don't catch it.
- Crowd's early bot picks (shown live) still come from one judge; the scoring job checks them (a wrong plan: a strike),
  but the live tally could have been wrong for that round.
- A quirk found on the way, left as it is (it would change every score): Stockfish's MultiPV output, cut short by the
  node budget, sometimes lists one move on two lines with different scores; the later line's score is kept.
- Server budget: with judges, the cap of 3000 searches a day lasts about 190 Crowd matches a day (16 searches each),
  then devices' numbers stand. Raising it is Eric's call (cost scales with the cap: about $25 a month per 3000 a day,
  worst case).

## Deep checks on players' computers (Oct 8, 2026; built, ships off)

Eric's idea, via the director: have two fast computers re-check the close calls before a cut instead of the engine
server, so the server is only used when a lobby has no capable devices or the devices disagree. Then Eric set the rule
for all engine work: fair scoring, correct results and smooth play first; players' devices wherever they can do the
job; our servers when truly needed, never skimping. Numbers: `reports/deep-timing.md`, `reports/deep-accuracy.md`,
`reports/deep-checks.md`.

**Built** (`JUDGES.deepOnDevices`, with tests and an e2e check):
- A capable device is a computer (never a phone: a 2M-node search every round drains a battery) whose speed check
  says it can do at least 1M nodes in 3 s (about 390k nodes/s). With two capable devices connected, a board's two
  judges are drawn from them, and the job asks them to re-check the close calls too, at the depth the slower one fits
  in 3 s (what the server takes today), at most the server's 2M.
- The device sends its quick answer first, as before, then its re-check (`judgedDeep`), so the quick numbers never
  wait for it. Both re-checks exactly alike: used. They differ (a strike for the one further from the server's), or
  don't come within 3.5 s: the engine server re-checks, as today.
- Measured in Chrome on this machine (`deep-timing.ts`): the app's engine runs about 490k nodes/s, so 2M nodes take
  4.1 s and 1.2M fit the window. The speed check (150k nodes) reads the same speed, so it predicts the re-check's time.

**Why it ships off.** The browsers' engine is the lite network; the server runs the full one. On the 267 close calls
of the judge-accuracy positions (`deep-accuracy.ts`), re-checked as the game does at 2M nodes:

| Re-check | Off the referee by 10+ points | Top-quarter players cut unfairly | Top-half players cut unfairly |
|---|---:|---:|---:|
| Engine server (full network) | 26 of 267 | 0.37% | 2.09% |
| Two computers (lite network) | 43 of 267 | 0.63% | 3.52% |

About 1.7 times as many unfair cuts. By Eric's rule, close calls stay with the server. The full network on computers
would match it, but in Chrome it runs at 260k nodes/s here (8 s for 2M nodes: too slow for a round), and its 99 MB
file is over Cloudflare's 25 MiB limit for a static file. Turn the switch on only with a device engine measured as
good as the server's (`deep-accuracy.ts`, then `judge-cuts.ts`).

**What it would save** (`many-judges.ts`, JUDGE_OUT=deep-checks; 6-person Crowd matches, 2 each):

| Capable devices in the lobby | Engine-server calls per match, as shipped | With the switch on |
|---|---:|---:|
| 0 | 15.5 | 15.5 |
| 1 | 15.5 | 15.5 |
| 2 | 15.5 | 0 |
| 5 | 15.5 | 0 |

(With the switch on and two computers, a round's wait for close calls fell from about 3.3 s to 2.2 s at the 95th
percentile.) A lobby has fewer than two computers 15% of the time at 10 people and 1% at 20, assuming 30% of players
on computers (with 20%: 38% and 7%); a ranked match (30+ people) almost never.

**Shipped (they cost nothing in fairness or time):**
- **Knocked-out players keep judging** while their page is open (watching, the cut screen, results), invisibly. It was
  already so in the lobby (judges are any connected device); now tested, and covered by the harness.
- **Disputes, never slower:** when two judges disagree, a third device (a capable one if the job carries a re-check)
  and the engine server are asked at the same moment; whichever settles it first stands: two of three devices exactly
  alike (the honest number, which is what agreement would have given), or the server's verdict. The server is still
  asked every time (disputes only come from cheaters, about 2 per cheater per match), because a third device can
  be slow, and a round must never wait longer than it does for the server. A late answer that disagrees is settled
  for blame by a third device alone when there is one (no server call).
- **Live players judge their own boards** (they always did: a job names nobody, and an exact match with an independent
  device catches a lie). The harness covers a lobby down to two people, both judging, and the endgame below.

**A match's endgame** (20 people, 6 on computers; a share of the knocked-out close the tab): the server is called
about 22 times a match as shipped, worst case 22 ($0.0022 at $0.0001 a search), almost all during the cut stages
with 8+ people connected (0.22 calls a round). In the last 10 rounds (the final, with 1–14 people connected,
depending on how many left) there were no calls at all: a final turn has one pick, rarely a close call, and no cut line.
With 90% leaving, one person was left connected at the end, and the host path scored it as before.
