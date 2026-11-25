# Residents PR 3 (#936): review fixes (Nov 25). Opus xhigh, FULL lane. A fresh helper; the review is the handoff

PR ericmueller21k-gif/chessroyale#936, branch `claude/residents-host` (head e51b09fb). Review: `REVIEW.md` on branch `review/residents-host`
(read all). Start: `git fetch origin claude/residents-host review/residents-host && git checkout -B claude/residents-host origin/claude/residents-host`.
Never read, print, log or commit a secret's value.

M4 is checked by the director: the Worker has no `OPS_ACCESS_CLIENT_ID` binding (names listed only), so the var is safe. Still update
ROADMAP.md:136-138 (it tells Eric to add it as a secret: now a var, don't).

Fix, each with a test that fails first where a test can show it:
- **M1** Access refusal gets its own exit code (e.g. 78); `start.sh` exits the container on it (no loop), so the next cron start brings the
  Worker's current secret. Also: `keepUp` keeps a hash of the env it started with in DO storage (never the secret) and restarts on change
  (covers m4).
- **M2** Off, paused and no-token all `halt` (paused first), whatever the off switch says, once the image exists; a var
  `RESIDENTS_HOST_IMAGE: "1"` set with the `containers` entry gates it until then (n5 too). Fix DEPLOY.md's "sleeps within 30 minutes" and
  the test that pinned "off wins over the pause".
- **M3** An instance id per start in the beat; the program refuses to start if another instance beat within 2 × `beatSeconds` (unless
  `--force`); `caller` says which token (`access:residents` / `access:test`). DEPLOY.md: host off (or pause) before a manual run.
- **m1** `own = RESIDENTS_COMMIT` slice: when the live version is its own commit, no drain; `own` is the start version when the first read
  fails. Rollback steps: "pause residents".
- **m2** `delete process.env.CF_ACCESS_CLIENT_SECRET` right after it's read; Maia spawned without it; reword start.sh's comment and the
  decision note to state what actually protects it (no repo/package code runs in git/npm; main is trusted as the Worker's bundle is).
- **m3** `ENV HOME=/home/node` in the Dockerfile (or `: "${HOME:=/home/node}"`).
- **m4** covered by M1's env hash (or run.ts reads `RESIDENTS.host.args` itself when started by the host).
- **m5** the drain decision as a pure function with a test; a small bash test of `start.sh` with stand-in `node`/`npm`/`sleep` (exit 75,
  backoff, exit 78 stops, TERM forwarding, the secret not in npm's env); fix the cold-start comment.
- Nits n1, n2, n3 (trim the secret, or "no token" when it has whitespace), n4 (pin `FROM` by digest). n6: leave, note it.
Run typecheck + the server unit tests + the new tests. Update `.pr-body.md` ("Review fixes"; changed checks old → new). Push, `.done`, stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Effort xhigh. ~1 hour.
