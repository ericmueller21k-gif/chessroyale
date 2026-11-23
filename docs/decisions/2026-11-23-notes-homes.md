# Audits and designs have their own homes, not decision notes (Nov 23, 2026)

The Nov 23 bloat sweep (N3, the same cause as Nov 19's): with no named home, audits and designs landed in `docs/decisions/`
(battle-tower-audit-2 2,904 words, tower-party 2,866, tower-shared-audit 1,598), and every tower helper reads them.
`docs/decisions/README.md` now names the homes: audits and reviews in `notes/` on `claude/director-notes`, open designs in
`docs/ideas/`, shipped designs in their area page. Call: the three existing files stay where they are (older decision files
aren't edited or moved); no new check.
