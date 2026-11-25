# Residents, PR 1: the server's side (Nov 25, 2026)

Eric: "have 200 bots made which just sit on the server and play ranked, play 50v50 ... simulate a small soft launch". Design: `notes/residents-design.md` (claude/director-notes).

- `users.resident`, `/api/admin/residents` (`residents.ts`), `PAUSE_RESIDENTS`, fair play's and the engine server's guards, the host rule.
- *(mine)* `PAUSE_RESIDENTS` is the server's own switch, not in `PAUSABLE`: `/api/status` never names it. The report (GET) answers while it's on.
- *(mine)* Sessions are stored as hashes, so "reuse" means the program's own cookie; a new session ends the resident's others.
- *(mine)* The seed's op key is `resident-seed:<ledger id>` (the ledger's rule: keys name the ledger id).
- *(mine)* "Would have" is a column, `fairplay_matches.would`.
- *(mine)* Host order: trusted people, trusted residents, then anyone.
- *(mine)* Engine server off for residents alone in Crowd, raids and Classic; Squads gets it with PR 7.
- `TEST_ACCOUNTS_CLIENT_ID` also works here for tonight's runs: removed when PR 3 brings the residents' own token.

## Review fixes (Nov 25; the review: `REVIEW.md` on `review/residents-server`)

- A real person's seat keeps the engine server on while they're in the match, connected or away (M1): `residentsOnly` is "no real
  person still in this match". The cost: it stays on for up to `LEAVING.awayMs` after the last real person really leaves.
- A real person back while a resident hosts takes the host's work again at once; the resident's late scores or boss move aren't heard (m1).
- Residents alone: none of the Hidden Boss's searches or wake-ups either (m3). *(mine)* Phase 1's server move too (his quick move, as with
  no engine server set up), not only phase 2.
- *(director's call, m4)* A real player's hard finds are measured against real people only: residents' picks are left out of a
  non-resident's `crowd`, `crowdFound` and `picks`; a resident's own rows keep everyone.
- *(mine)* Residents alone, the host's score request no longer says `serverRecheck` (the server never re-checks their scores, so the host
  re-checks its own close calls, as with `ENGINE_OFF`). Found while fixing M1: before, nobody re-checked them.
- A seat is marked a resident's as `connect()` takes it (n6); the heartbeat's `content-length` is checked before the body is read (n1);
  the pause cache is keyed by the token's hash (n2).

- Delta review (Nov 25, `DELTA.md` on `review/residents-server-delta`), fixed by the director: **d-m1** residents alone at the Hidden
  Boss's phase-1 move: his quick move at the host's window's end, never another resident's window (two residents took turns forever);
  **d-m2** a person back while a resident hosts: the phase's timer starts again for them, so the old one doesn't hand the work back.
  Nits a-e left (a: `resendHostWork` without `serverRecheck`, safe double work; c: with residents filling seats, a real player's crowd
  is often under `minCrowd`, so their hard finds use the solo model).

### Later

- m2 (PR 4): the dashboard counts distinct residents per "would have" level (or each one's worst), not rows.
- m6 (PR 3): pin `OPS_ACCESS_CLIENT_ID` to the health script's client, a line in PR 3's security notes.
- n3, n4, n5 (the program, PR 2): call the report without a resident's cookie; one cookie jar per resident; take `name` from the answer.
- n7: `residentAccount` isn't atomic (a request that dies between the insert and the seed leaves that resident unseeded): fine to leave.
- n8 (PR 4): render the heartbeat as text.
- n9 (design wording): §4's "Eric's device hosts whenever he's in a lobby" should say "unless benched".
