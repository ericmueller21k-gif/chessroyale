# Residents host switched on (Nov 25, 2026)

- Eric OK'd Cloudflare for the residents (~$52 a month, usage-billed) and gave the token the Containers Edit permission.
- The image (`scripts/residents/container`, built from the Dockerfile's pinned base via mirror.gcr.io) is pushed as
  `chessroyale-residents@sha256:6a79bb76…293a`. This change adds its `containers` entry (standard-2, max 1) and sets `RESIDENTS_HOST_IMAGE`
  and `RESIDENTS_HOST_ON` to "1": the next 15-minute cron after the deploy starts it.
- (Pushing needs the full registry name: `docker tag chessroyale-residents:1 registry.cloudflare.com/<account>/chessroyale-residents:1`, then
  `npx wrangler containers push` that name; a bare local tag goes to Docker Hub and is refused. DEPLOY.md updated.)
- Off: `RESIDENTS_HOST_ON` "0" (a PR) or `PAUSE_RESIDENTS` (dashboard): DEPLOY.md, "Residents".
