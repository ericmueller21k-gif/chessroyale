# HunChess launch audit (Nov 24, 2026)

Already known and left out: the LLC, Stripe and its purchase screens, and the Settings cleanup.

## Must have before any public launch (most important first)

1. **Legal pages are still drafts.** `/privacy`, `/terms` and `/copyright` carry a "DRAFT — not yet reviewed" box with blanks still to fill: who runs HunChess and a postal address, governing law, a DMCA agent ($6 at the US Copyright Office), the EU/UK wording, and how long fair-play records are kept. The support@hunchess.com address on every page and on the ban screen must reach a real inbox (Cloudflare Email Routing, free). Evidence: `packages/app/src/screens/Legal.tsx:24-66`, `ROADMAP.md` "Needs Eric".
2. **Turning Zero Trust off needs a checklist, and none is written.** `DEPLOY.md` has no launch-day steps. These items are known:
   - Keep Access on `/admin/*` and on the health path, and put the new AUD into `ACCESS_AUD`.
   - Delete the demo accounts, then set `TEST_ACCOUNTS_CLIENT_ID` back to `""`. It is still set in `wrangler.jsonc` `vars`.
   - Confirm `TEST_SWITCHES` is unset.
   - Add the bypass for Stripe's webhook.

   Evidence: `ROADMAP.md` §7 and "Only Eric can do", `notes/fable-plan.md` "Eric's calls".
3. **The repository is public, director notes included.** The `claude/director-notes` branch holds the outside security review's findings, its proof tests and the anti-cheat thresholds. The plan is to make the repo private at launch (`ROADMAP.md`, "At launch"), and that brings a cost:
   - Main gets about 20 PR merges a day. Each full run on main uses 15 runners for about 27 minutes each, roughly 400 runner-minutes.
   - That adds up to thousands of minutes a day. A free private repo gets 2,000 minutes a month.
   - Rough cost: several hundred to about $2,000 a month in paid Actions, unless CI is trimmed or only the notes move to a private repo.
4. **Capacity hasn't been retested since October.** The last real load test was on Oct 8: at 5,000 players, 3,823 failed at `/api/me` (`reports/load/staging-5000.md`; `docs/history/ops.md:207`). The schema fix landed Nov 10, but nobody has re-run the test. Since then the town square, global chat, friends, XP and quests, and the ban gate were added, and none has been load-tested. `docs/areas/ops.md:155-159` itself asks for a ban-gate load test before launch. Run 1k and 5k on staging.
5. **Monitoring is built but switched off.** Several steps are Eric's own:
   - The Discord alerts stay silent until `ALERT_WEBHOOK` is set.
   - Billing budget alerts ($25 and $100), usage notifications and a free uptime check on `/api/live` still need setting up (`DEPLOY.md:176-191`).
   - No `RUNBOOK.md` exists yet, and the D1 restore drill hasn't been done (`ROADMAP.md` launch steps 5-6).
6. **Sign-in hardening is unbuilt** (outside review, batch 5). Sign-in codes are still 6 digits and not tied to the browser (`packages/server/src/accounts.ts:792`). There is no Turnstile and no block on throwaway email domains (`ROADMAP.md` item 6). Without these, scripts can mass-create accounts to farm crates, spam chat or get around bans.
7. **Money-adjacent decisions to make before Stripe goes live:**
   - The struck-through "50% off" prices (`SHOP.discount: 0.5`, settings.ts) are a deceptive-pricing risk once money is real.
   - Coins buy keys and keys open random crates, which makes them paid loot boxes. Odds are shown, but the outside review advised keeping random crates free. The plan sells only in the US and Canada, to buyers 16 and up (`docs/decisions/2026-11-17-payments-design.md` §9).
   - Taxes: Stripe Tax registration by state and the Canadian GST threshold.
   - Payments PRs 2-12 are unbuilt; only PR 1, the prices, is done (#790).
8. **The Hidden Boss resembles a real person.** He uses that person's real quotes, and the likeness and publicity rights are flagged "check before launch" (`ROADMAP.md` ~line 337).

## Should have soon after

- **Security headers:** the app sends no CSP, HSTS or frame-ancestors. Only the admin page sets `x-frame-options` (`packages/server/src/admin.ts:654`). HSTS is a toggle in the Cloudflare dashboard.
- **Admin access:** whoever controls an `ADMIN_EMAILS` inbox is an admin. Keep Access on `/admin/*` and put 2FA on Eric's Google and email.
- **Fair-play trust gaps** still open (`ROADMAP.md` §7):
  - judges chosen by their measured speed, not the speed they claim;
  - a lone host's boards sampled on the server;
  - matchmaker reservations per account, not per ticket;
  - Squads' paid jobs spot-checked.
- **Bans need a person:** fair play runs at `enforcement: "pool"`, so someone must work the review queue daily (`settings.ts:4576`).
- **Chat filter gaps:** look-alike letters and contact info get through (`fable-plan.md` batch 9).
- **Live ops pieces 2-4** (the on-call agent, a bot that plays the live site, gradual releases) aren't built (`docs/ideas/live-ops.md`).
- **A notice about bots:** the "beta / quiet hours: expect more bots" notice Eric asked for on Nov 10 isn't built.
- **Browser coverage:** e2e runs Chromium only (`playwright.config.ts:54-57`), so Safari and Firefox are untested apart from Eric's phone.
- **Sharing and search:** no `og:`/twitter share tags and no `robots.txt` (`packages/app/index.html`).
- **Licenses:** `LICENSES.md` was last updated Oct 31. Re-audit the art, sounds and rides added since, and note where the AI-generated art came from.
- **Launch scope:** four bosses are still admin-only (`BOSS_ADMIN_FIRST` = timber, dash, zebra, chandy), and Classic is frozen. Decide what's in.
- **Guest progress:** a guest's progress lives in one cookie, so clearing it loses coins and crates. Prompt guests to sign in.

## Already solid

- Sign-in uses Google or an emailed code, with no passwords. Codes and sessions are stored hashed, and the cookie is HttpOnly, Secure and SameSite=Lax. Sending is rate-limited (`docs/areas/accounts.md`).
- Account sign-up needs age 13+, and the birth date is never stored (`packages/core/src/age-gate.ts`).
- Players can download their data and delete their account (`packages/server/src/account-data.ts`).
- Rate limits are per address and per account, and an overload queue catches surges (`limits.ts`, `CAPACITY`).
- Test switches work only for admins or where `TEST_SWITCHES` is set (`testSwitchesOn`, `admin.ts`).
- Kill switches, a maintenance banner and `npm run rollback` are in place (`kill-switches.ts`, `scripts/rollback.ts`).
- Errors are captured, and `/admin/ops` shows health and player reports (`docs/areas/ops.md`).
- Chat has a filter, report, mute, block, chat bans and a pause switch; names are filtered too (`docs/areas/chat.md`, `text-filter.ts`).
- Fair play has reports, signals, deep re-checks, bans that block sign-in and a review page (`docs/areas/fairplay.md`).
- Each crate's page shows its odds (`packages/app/src/screens/Crates.tsx:529`).
- Cookies are only the ones the game needs, with no analytics, so no consent banner is needed (`Legal.tsx:371`).
- The GPL and AGPL engines (Stockfish, Maia) are served with their full source (`LICENSES.md`, `packages/maia-worker/README.md`).
- Engine re-checks are capped at 3,000 a day, and Workers Paid ($5/month) is already on (`DEPLOY.md:18-28`).
- A scan of the repo found no secret values, only test fixtures.
- The app installs as a PWA, and first-time players get a 13-slide walkthrough and a FAQ (`components/Walkthrough.tsx`, `screens/Faq.tsx`).
