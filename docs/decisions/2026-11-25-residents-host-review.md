# Residents host: the review's fixes (Nov 25, 2026)

From PR #936's review (`REVIEW.md` on `review/residents-host`), as the director's brief named them. The calls in them:
- *(mine)* A running host whose environment changed (new secret, new options) is stopped; the cron's next run starts it (at most 15 minutes without residents). Only a SHA-256 of the environment is kept.
- *(mine)* Exit 78 ends the container; each cron run starts a fresh one until the token is fixed, or the host is paused or off.
- *(mine)* The one-program check skips a beat that says `stopped` (a clean stop's last), so the restart after a deploy is at once. The program beats before Maia and the sign-ins.
- *(mine)* The base image's digest is a build argument's default, so a builder without AWS's mirror uses mirror.gcr.io, same digest.
- n6 left: "a deploy doesn't restart the container" is from the docs; check Observability on the first deploy with the host on.
