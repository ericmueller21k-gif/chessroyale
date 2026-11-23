# Decisions, one file each

Every decision made from Oct 15, 2026 on: why something is the way it is, with the date and the reason. Older ones are
indexed in [`DECISIONS.md`](../../DECISIONS.md) (and kept word for word in [`docs/history/`](../history/)). How things
work today is in [`docs/areas/`](../areas/README.md).

## Writing one

**Not here:** an audit or review goes to `notes/` on the `claude/director-notes` branch (the director reads it; helpers
don't), and a design still being decided goes to [`docs/ideas/`](../ideas/), then into its area page once it ships. A
decision note says what was decided and why, in about 200 words, and links the design or audit it came from.

- **One new file per decision**, named `YYYY-MM-DD-short-title.md` (lower case, hyphens), so the folder lists them in
  the order they were made. A PR may add several. Never append to `DECISIONS.md` and never rewrite another lane's
  file; a later decision that changes an earlier one gets its own file and links back.
- **First line:** `# Title (Mon D, YYYY)`, as the sections in `DECISIONS.md` were.
- **Then:** what was decided, the reason, Eric's words when he made the call (quoted exactly), the numbers or measurements
  behind it, and the calls you made yourself. Short beats complete: link reports in `reports/` for the long tables.
- **Code comments** cite the file: `docs/decisions/2026-10-15-short-title.md`.
- When a decision changes how an area works, update its page in `docs/areas/` in the same PR.
