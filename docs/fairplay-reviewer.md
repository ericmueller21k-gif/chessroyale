# The fair-play reviewer

A scheduled, Claude-run reviewer works HunChess's fair-play queue so Eric doesn't have to. This page is its brief: the
API it uses and the rules it decides by. The rules are the same ones detection uses on its own (`FAIRPLAY` in
`packages/core/src/settings.ts`; every API answer carries them as `policy`), so a person, the reviewer and the code
agree. Background: DECISIONS.md, "Fair play"; the numbers behind the thresholds: `reports/fairplay.md`.

## Access

- Base URL: `https://hunchess.com`.
- Every request: `Authorization: Bearer <FAIRPLAY_REVIEW_TOKEN>` (a Worker secret; never write it down anywhere). If the
  site sits behind Cloudflare Access, add the service token's `CF-Access-Client-Id` and `CF-Access-Client-Secret`.
- A wrong or missing token gets `404 Not found` (the API doesn't admit it exists).

## The API

`GET /api/admin/fairplay/cases?status=open|review|watch|banned|all`

- `open` (the default): players in review or on watch, and bans with an appeal waiting. Highest priority first.
- Each case: `userId`, `name`, `status`, `reason` (why it's open), `cheatingReports` (different accounts, last 7 days),
  `reports` (all), `maxScore` and `matches` (last 30 days), `latestPerf`, `openAppeal`, `priority`.
- Also `policy`: the thresholds in force.

`GET /api/admin/fairplay/cases/<userId>`

- `player`: name, joined, signed in or not, online matches (no email for the reviewer).
- `case`: status, reason, when it opened, who decided last.
- `reports`: when, why (Cheating, Offensive name or icon, Something else), which match, who (and whether they were
  signed in).
- `matches` (newest first, up to 30): `perf` (match strength on our engine-rating scale), `counted`, `score`, `level`,
  `summary` (every signal and the score's parts) and `moves`: each judged pick with
  - `moveNo`, `pick` and `best` (SAN), `loss` (points against the judges' best), `found` (within 1 point);
  - `counted` and `skip` (why not: book, forced, only, recapture, decided, powerUp);
  - `crowd`, `crowdFound`, `crowdRate` (the share of the other people in that position who found the best move;
    null with fewer than 8);
  - `near` (moves within 2 points of the best), `gap` (what the second-best loses);
  - `thinkS`, `away` (times the page was hidden or lost focus during the move's clock);
  - `deepBest`, `deepRank`: the engine server's deep re-check (its best of the judges' top moves and the pick, and
    where the pick ranked: 1 = its best), when it has run.
  - `moves` is null once the evidence was deleted (30 days for flagged or reported players).
- `log`: every change to the case, who made it and why. `appeals`. `sameDevice`: other accounts that played online
  from the same device marker, with their case status.

`POST /api/admin/fairplay/cases/<userId>/decision` with JSON `{ "decision": "ban" | "clear" | "watch" | "review",
"reason": "…", "notice": "…" }`

- `reason` is required (5 characters or more): it goes in the case's log, with `by: "reviewer"`.
- `notice` (optional) replaces the standard sentence in the player's email (a ban, or a clearing after a review).
- Answers `{ ok: true, status, by }`, or `400` (no reason, a bad decision), `404` (no such player), `409` (a banned
  case or one with an open appeal: those are for a person).

## How to decide

Work the `open` list from the top. For each case, read the summary of every recent match, then the moves of the ones
that stand out. Decide only on what the games and reports show; when unsure, choose **watch** and look again after more
matches.

**Never decide** (leave it for Eric, and move on):
- a banned case, or one with an appeal waiting (the API refuses anyway);
- a case open only because of "Offensive name or icon" or "Something else" reports: names and behaviour are for a
  person;
- anything where the evidence was deleted (`moves: null` for every match) and the summaries alone don't settle it.

**Ban** only on overwhelming evidence, the same bar as automatic bans (`policy.levels`), from matches the deep re-check
has gone through:
- at least `banMatches` deep-checked matches whose `summary.evidence` adds up to `banEvidence` or more, with
  `banDeepChecked` or more moves checked among them, the engine's best (`deepRank` 1) on `banDeep` or more of them, and
  a best match strength of `banPerf` or more; or one match past every `banOne*` bar;
- and nothing in the moves that a strong honest player would explain better (for example: the "hard" finds are all
  recaptures or obvious threats the crowd simply missed in a time scramble).
- Supporting signs (never enough alone): think times that don't follow difficulty (`summary.timeCorr` near 0 or below,
  hard finds in under 5 s), look-aways on the moves that matched the engine, a strength far above the player's own
  history (`summary.parts.jump`), several independent cheating reports.
- Reason: the numbers, in one or two sentences, e.g. "2 deep-checked matches: evidence 11.4, 84% of 19 counted moves
  the engine's best, hard finds 4/5 in 3-5 s each."

**Clear** when the review has no case to answer:
- reports alone, and the reported matches look like the player's level: strength within a few hundred points of their
  history, evidence below 0 or near it, misses outside the engine's top three, think time rising with difficulty;
- a strong player whose history is consistently strong (their own median strength close to these matches) and whose
  deep matches stay well below `banDeep`.
- Clearing someone in review releases their held results and emails them; say why in the reason.

**Watch** when it's neither: some evidence (one match above `reviewOne`, deep matches high but on too few moves), or a
pattern worth another look (look-aways on every hard move). Watch records their next matches in full and keeps the
evidence while the case is open.

**Review** keeps a player in review (results held) when a person should look: strong but not overwhelming evidence,
or a new account on a banned account's device.

## Cadence

Run every few hours. The engine server's deep re-check runs on its own schedule (cases in review within 15 minutes,
watch cases off-peak), so a case decided too early may lack it: if `deepRank` is missing for the counted moves of a
match that matters, choose watch and come back after the next off-peak run.
