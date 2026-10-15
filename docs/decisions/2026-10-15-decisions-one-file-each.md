# Decisions: one file each (Oct 15, 2026)

- **New decisions go in `docs/decisions/`, one file each** (`YYYY-MM-DD-short-title.md`), not at the end of
  `DECISIONS.md`.
- **Why:** with the e2e suite on GitHub Actions and several PRs open at once, every PR appended its section at the same
  place, the end of `DECISIONS.md`. Each merge made every other open PR conflict there, and each fix (a merge of `main`
  and a new push) cost another full CI run of about 17 minutes. Separate files can't conflict.
- `DECISIONS.md` keeps its index of decisions up to Oct 10 and its "New decisions" sections written up to Oct 15,
  unchanged; its "How this file works" says where newer ones go. `CLAUDE.md`, `docs/areas/README.md` and the
  `.claude/agents/` ship steps say the same.
- PRs already open when this landed may keep their `DECISIONS.md` section, or move it into a file here when they next
  merge `main`.
