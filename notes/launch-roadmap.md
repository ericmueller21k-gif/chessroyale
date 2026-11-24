# Launch roadmap (Nov 24, from notes/launch-audit.md and notes/swarm-audit.md). Not a date: Eric isn't launching yet.

## Eric's side (accounts, money, legal, switches only he can flip)
1. LLC; then the business details the legal pages need (name, postal address, governing state).
2. Stripe account (in the LLC's name), Stripe Tax registrations as needed; Canada GST threshold.
3. ~~Lawyer pass~~ DROPPED by Eric (Nov 24, vetoed; never raise it again).
4. DMCA agent at the US Copyright Office ($6).
5. ~~support@hunchess.com forwarding~~ DONE (Eric, Nov 24: already forwards to him).
6. Monitoring switches: a Discord webhook for alerts (ALERT_WEBHOOK), Cloudflare billing alerts ($25, $100), usage notifications,
   a free uptime check on /api/live; 2FA on his Google and email (admin access follows those inboxes).
7. Decisions: drop the struck-through "50% off" prices or make them real; whether coins can buy crate keys (paid loot boxes);
   launch lineup (the four admin-only bosses, Classic in or out); whether to make the repo private or only move the notes.
8. Launch day: remove Zero Trust from the public site (we write the checklist first).

## We build (helpers)
1. Payments: Stripe checkout, the purchase screens, webhooks, receipts, refunds (PRs 2-12 of the payments design).
2. Settings screen cleanup.
3. Legal pages filled in once Eric's details exist (the drafts are built).
4. Launch-day checklist (DEPLOY.md): keep Access on /admin and health, delete demo accounts, clear TEST_ACCOUNTS_CLIENT_ID, confirm
   TEST_SWITCHES unset, Stripe webhook bypass; a RUNBOOK.md; one D1 restore drill.
5. Sign-in hardening: Turnstile, longer codes tied to the browser, throwaway-email block.
6. Load test again: update the fake-player swarm (team turns, behaviors: leaver, AFK, reconnect, slow, chatter), run 1k and 5k on staging,
   fix the sign-in batch; later the other modes and 10k. (~1.5-2 helper-days first version; Eric said not yet, Nov 24.)
7. Security headers (CSP, HSTS, framing); chat filter gaps (look-alikes, contact info); "beta / expect more bots" notice; guest sign-in
   prompt; share tags and robots.txt; Safari/Firefox in CI; a license re-audit.
8. Town paper walls: check which camera angles show building edges; clamp the camera (about a day) before launch.
9. Fair-play trust gaps (ROADMAP §7) and a daily ban-review routine.
