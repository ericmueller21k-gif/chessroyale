# The engine pool: flagged players only ever meet each other (Eric, Nov 10)

Eric's words: "We flag their account right off the bat as they're using an engine. And we pair them only with other engine players.
And we also, though, this list I want to see ... if they start getting crushed, then we know that it was probably a false positive,
and then it's an easy thing for me to review and unban. But if they continue to just play insane engine moves ... we just keep them in
hell basically and I mean for every mode ... they won't even find players. The only other players they'll find who are all in this ...
Or again, they can get bots. Bots will fill after a certain amount of time ... they will have no clue it's even happening." On new
accounts: "if 2 out of the first 3 games they play are just like straight stockfish" ... "for the first 10 games". He also wants the
data kept ("what ELO they were playing at, and like what moves") for a possible article later.

Read docs/areas/fairplay.md, docs/areas/matchmaking.md and the fair play code (`packages/server/src/fairplay.ts`, `FAIRPLAY` in settings).

## Build
1. **Into the pool** (a new case status or a flag, least code; record when and why):
   - a new account: within its first `FAIRPLAY.pool.newGames` (10) counted games, any `FAIRPLAY.pool.newHits` (2) games at the one-match
     ban bar (the existing per-match "ban-level" evidence: near-perfect engine play), straight away, no review;
   - any account: when its level reaches what used to be "ban" (`actOn` under `enforcement` → a new `"pool"` mode, now the setting).
   Only vouched matches count (unvouched ones already write no fair-play rows). Bans stay a person's (the reviewer token never bans).
2. **Every queue sends a pooled account to its own pool:** 1 v 1 (ranked and not), 50 v 50, Squads (a party with a pooled member
   queues in the pool), Boss Battle online. Reuse the matchmaker's existing pool name (`queueName`'s `pool`, as `?pool=` tests use):
   the server sets it from the account, never the browser. Bots fill after the usual wait. Nothing on screen differs. Pooled
   accounts' ranked results don't reach public leaderboards (their own profile looks normal to them).
3. **The admin page** (`/admin/fairplay`, a new "Engine pool" list): each pooled player with when and why they entered, their rating,
   games, the evidence (moves and engine-match numbers, kept), and **how they do in the pool** (their results against other pooled
   players: a player getting crushed there is likely a false positive). One button: **Release** (back to normal queues, logged).
4. **Keep the data** for later (the article): pooled players' evidence is kept while pooled (not purged on the usual timer), and
   included in the admin list's export (a JSON download is enough).

Lane: full (fair play and matchmaking): the director adds `full-e2e`; one independent review follows with **at most one fix round**
(Eric, Nov 10: no more loops). Effort xhigh. Unit tests: the new-account rule (2 of the first 10 at the bar → pooled; 1 → not), the
level path, every queue's pool routing from the account, Release, leaderboard exclusion. One e2e: a pooled account queues and meets only
the pool (or bots). Update docs/areas/ (fairplay, matchmaking) and the FAQ only where it would mislead (no need to announce the pool).
Decision note docs/decisions/2026-11-10-engine-pool.md (≤ 120 words). Push to claude/engine-pool at each real step; as your LAST push
write .pr-body.md and .done together. Don't open the PR. Read CLAUDE.md and notes/briefs/rules-common.md first.
