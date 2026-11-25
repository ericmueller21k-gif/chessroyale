# Payments PR 11 (drafts only): the public pages' text (Nov 26). Haiku, medium, light lane, branch `claude/pay-legal-drafts`

Source of truth: `docs/decisions/2026-11-17-payments-design.md` (on main) and `notes/briefs/payments-design-v2.md` /
`payments-answers.md` (on `claude/director-notes`). Write DRAFTS ONLY, as Markdown files under `docs/drafts/payments/` (new folder);
nothing is served, linked or wired. Steps:
1. Read the design doc's sections on prices, packs, who may buy (ages, the $50 month), refunds, chargebacks, closing, purchases data, and
   section 12. List each fact you use with its section number at the end of each file ("Sources").
2. Write five files, plain American English, short paragraphs, headings, no legal jargon beyond what the design uses:
   `terms.md` (Terms of Service: the coins are a license to use in-game, not money; no cash value; who may buy; closing an account;
   changes to terms), `refunds.md` (the refund policy exactly as the design says), `prices.md` (packs and prices from `PAYMENTS.packs`
   in `packages/core/src/settings.ts`, read the real numbers), `privacy-purchases.md` (what purchase data is kept, how long, delete and
   download), `contact.md` (support@hunchess.com, what to include).
3. Where the design doesn't say something a page needs, write `[TODO for Eric: …]` instead of inventing it.
4. Never mention any lawyer or legal advice. Never name the Hidden Boss. No model names.
5. `docs/drafts/payments/README.md`: one line per file, and "Drafts: final after payments PR 9 (refunds)".
6. `.pr-body.md` (what, that nothing is served, the TODO list), commit, push, empty `.done`, push, stop. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
