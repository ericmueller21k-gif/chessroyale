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
