# Residents, PR 3: the always-on host (Nov 25, 2026)

Eric OK'd Cloudflare (~$50 a month) and made the "residents" Access token. Design: `notes/residents-design.md` (claude/director-notes).
- *(mine)* Its own image, pinned by digest like the engine server's (Eric pushes it once), not a public Docker Hub image (uncached, pull limits) or the beta `durable_object` policy; standard-1, since custom sizes can't be checked with our tokens.
- *(mine)* The restart loop is inside the container (`start.sh`): exit 75 after a deploy fetches the new `main` at once; anything else waits 1 to 15 minutes.
- *(mine)* `RESIDENTS_HOST_ON` (wrangler.jsonc, "0") is the director's on switch; off, the cron never touches the host, so it merges before the image exists. The `containers` entry comes with the digest.
- *(mine)* npm runs `--ignore-scripts`, without the secret in its environment; the image runs as `node`, not root.
- *(mine)* m6: `OPS_ACCESS_CLIENT_ID` pinned in `vars` to the ops scripts' token (the same as `TEST_ACCOUNTS_CLIENT_ID`, already public). The residents route still takes that token, for the director's own runs.
- Verified from Cloudflare's docs, not on the live account (our API tokens can't read Containers): a Worker deploy with no container change starts no rollout; outbound traffic leaves through the internet, so it meets the edge and Access as any client. The first start proves both.
