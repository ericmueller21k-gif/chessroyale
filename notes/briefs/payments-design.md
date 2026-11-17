# Payments: the design (read-only + one design doc). ranked/hub/ops lanes touch it; full lane later. Opus, high

Branch `claude/payments-design` from main. About 1.5 h. No code changes: one design doc `docs/decisions/2026-11-17-payments-design.md`
(dated, the approved inputs first). Read CLAUDE.md, `docs/areas/shop.md`, `docs/areas/accounts.md`, `docs/decisions/2026-10-16-*`
(age gate, real money, atomic shop purchase), the XP/quests settings (settings.ts `XP`, quests), `SHOP`, `BOSS_CRATE_PRICE`, the
ledger (server), and Eric's answers: `notes/briefs/payments-answers.md` on claude/director-notes (all of it: three rounds).

Design, with the reasons, for Eric's OK:
1. **Stripe** (web only): Checkout vs Payment Element (pick the least code that gives Apple Pay/Google Pay), webhooks into the Worker
   (signature check, idempotency: a payment credits once), test mode on the private site, the keys as Worker secrets (never in the repo).
   Exact current fees (US cards, international, Stripe Tax, disputes) from Stripe's pricing pages, with the date read.
2. **One coin, two ledgers underneath:** bought vs earned coins recorded apart (D1 schema sketch), earned spent first, refundable =
   bought and unspent within 14 days. One number shown everywhere; the one-time pop-up after the first purchase; the profile line
   "Total coins N · Refundable N".
3. **Refunds** (approved): Refund button (whole or unspent part, 14 days, Stripe refund API); item return once per 30 days (item
   removed, the key's money back); unauthorized/parent claims; chargebacks (coins back, may go negative, buying blocked).
4. **Prices** (approved): 100 coins = $1, key 100 coins (from 250), packs $1.99/200, $4.99/520, $9.99/1100, $19.99/2300, $49.99/6000.
   Re-balance the other coin prices (shop crates, bundle, God King packs, chat packs) and check the flow: crates earned (level,
   daily, quests) vs keys (level + coins at ~1.8/min): a 1 h/day and a 3 h/day player's crates vs keys per week. Never pay-to-win.
5. **Who may buy:** US + Canada (card country / IP), under 16 no buying, 16-17 $50/month (the age gate's extra "18+"/"16+" answers;
   no birth date stored), Belgium never. Sales tax: Stripe Tax, thresholds.
6. **Earn-first screen:** packs show "or about N hours of play"; next free key/crates; no pop-ups, timers or fake discounts on packs;
   the beta 50% ends when real money turns on.
7. **Before live (Eric's):** LLC, Stripe account, public terms/prices/refund/contact pages (Access off those paths), the AI legal pack.
8. Build plan in PRs (each its lane: full for money/stored data), with tests.

Under 250 lines. Push the doc, `.pr-body.md` (10 lines) and `.done`. Questions only Eric can answer: `.question`. No PRs, no CI waits.
