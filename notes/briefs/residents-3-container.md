# Residents PR 3: the always-on host (Nov 25). Opus xhigh, FULL lane (a production token in a container: security)

Design: `notes/residents-design.md` on `claude/director-notes` (§1 "Recommendation (b2)", "How it stays up", §3 "PR 3", §4 Security, "To
verify in PR 3"). Eric OK'd Cloudflare (~$50/mo, usage-billed) and made the Access service token "residents":
- Client ID: `4bea329adb64a99cfe4f020046bb9bd4.access` (not a secret: put it in `wrangler.jsonc` vars `RESIDENTS_CLIENT_ID`).
- The client secret is a Worker binding `RESIDENTS_CLIENT_SECRET` (Eric is switching it from Text to Secret type). NEVER read, print, log or
  commit its value; the container gets it from the Worker's env at start.
- Eric added the token to the hunchess.com Access app's Service Auth policy (unverified: the container's first sign-in proves it; if it's
  refused, report exactly what's refused, never work around it).

Start: `git fetch origin main && git checkout -B claude/residents-host origin/main`. Read CLAUDE.md, DEPLOY.md (the engine container: how
it's built, pushed, its class), `wrangler.jsonc` (containers, crons, keep_vars), `docs/areas/ops.md` (Residents, kill switches),
`packages/server/src/residents.ts`, `scripts/residents/run.ts`.

Build:
1. **A generic image** (Node + git): at boot it clones `main` (public repo, no credentials), `npm ci`, builds what Maia needs, starts
   `scripts/residents/run.ts` (forever) with `CF_ACCESS_CLIENT_ID`/`SECRET` from its env. Instance: the smallest that fits (design: custom
   1 vCPU / 3 GiB if offered, else standard-2); `sleepAfter` ~30 min.
2. **A container class** in the Worker, started/kept awake by the existing `*/15` cron unless `PAUSE_RESIDENTS` is set; stopped when it is.
3. **Version-aware restart:** the program watches `/version.json`; after a deploy it lets games finish, exits, and the container restarts
   on the new `main`.
4. **Security notes** (PR body + decision): the token's scope, revocation, the review's m6: pin `OPS_ACCESS_CLIENT_ID` so the health view
   doesn't take any service token (set it to the health script's id if known, else note it for the director). The route keeps accepting
   `TEST_ACCOUNTS_CLIENT_ID` (the director's runs) — note it.
5. **Verify** (from the design): outbound to hunchess.com goes through the edge + Access as an outside client; whether a Worker deploy
   restarts the container; instance sizes offered. Use `CLOUDFLARE_API_TOKEN` for reads and the image push if its scopes allow
   (`wrangler containers build --push`); if not, say exactly what Eric must run, once. Do NOT switch the container on in production:
   the director does, after merge (it starts the spend).
6. Docs: `docs/areas/ops.md` Residents (how it runs, start/stop, cost), DEPLOY.md, a short decision file. Tests: unit tests for the cron's
   start/stop logic and the pause; typecheck.
`.pr-body.md` (lane full; changed checks), push at each real step, `.done`, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Effort xhigh. Aim: 2 hours.
