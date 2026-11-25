# Residents, PR 3: the always-on host (Nov 25, 2026)

Eric OK'd Cloudflare (~$50 a month) and made the "residents" token. Design: `notes/residents-design.md` (claude/director-notes).
- *(mine)* Our own image pinned by digest, as the engine server's (pushed once), on `node:22-bookworm` (git included, no `apt`: it builds anywhere). Not Docker Hub (uncached, pull limits), not the beta `durable_object` policy.
- *(mine)* standard-2: 40 online measured 0.25 vCPU (0.43 at peaks), 0.6 GiB; ½ vCPU is tight at wave peaks; custom sizes can't be checked with our tokens. About $52 a month.
- *(mine)* The restart loop lives in the container (`start.sh`): exit 75 after a deploy restarts at once, anything else waits 1-15 min.
- *(mine)* `RESIDENTS_HOST_ON` "0" is the director's switch; off, the cron never touches the host, so this merges before the image exists.
- *(mine)* npm runs `--ignore-scripts` without the secret; the image runs as `node`.
- *(mine)* m6: `OPS_ACCESS_CLIENT_ID` pinned in `vars` to the ops token (already public as `TEST_ACCOUNTS_CLIENT_ID`).
- From the docs (our tokens can't read Containers): a deploy with no container change starts no rollout; traffic leaves through the internet, so it meets Access as any client's.
