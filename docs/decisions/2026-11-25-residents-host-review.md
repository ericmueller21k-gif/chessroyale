# Residents host: the review's fixes (Nov 25, 2026)

From the review of PR #936 (`REVIEW.md` on `review/residents-host`); the director's brief named each fix. The calls made in them:
- *(mine)* A running host whose environment changed (a new secret, new options) is stopped, and the cron's next run starts it: at most 15 minutes without residents, rather than waiting on the library's monitor inside the cron. Only a SHA-256 of the environment is kept.
- *(mine)* Exit 78 (Access refused the token) ends the container, and each cron run starts a fresh one: a bad token costs one start (a clone and an install) per 15 minutes until it's fixed, or the host is paused or off.
- *(mine)* The one-program check skips a beat that says `stopped` (a clean stop's last), so the restart after a deploy is at once; the program beats once before Maia and the sign-ins, so one starting then sees it. A crash sends no `stopped`: its restart may wait one backoff.
- *(mine)* The base image's digest is a build argument's default, so a builder that can't reach AWS's mirror builds from mirror.gcr.io with the same digest.
- n6 left as is: "a Worker deploy doesn't restart the container" is from the docs; to check in Observability on the first deploy after the host goes on.
