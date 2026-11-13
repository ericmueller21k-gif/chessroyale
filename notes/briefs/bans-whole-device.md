# PR #687 (bans): the whole device is banned (Eric, Nov 13, final)

Effort high. Branch `claude/ban-blocks-sign-in` (`git pull` first). Eric: "No, just the whole device is banned. We're not tolerating any
fucking bullshit. If you get banned and your sister gets upset about it, so be it. We can always revert it later."
Change ONLY this (keep everything else from the review round: M2 forgetToken, the app's re-asks, evasion accounts, Origin/JSON checks,
banCheckMs 60 s, the button and email wording, `/admin/*` out of the gate):
- A browser carrying the mark of a banned account is refused on EVERY gated route, sign-in routes included, whatever session it carries
  (another account's session too): the ban answer, as the first round had it. Lifting the ban removes the mark as before.
- The ban screen shows only the line again: remove the "Sign in to another account" box.
- A refused sign-in on that browser ends whatever session it carried (as the first round).
- Tests: the family-tablet test inverted (the sister on the marked tablet gets the ban answer and can't sign in); the e2e `onlyTheBan`
  back to "only the line, no button"; the e2e step where another account signs in from the ban screen removed.
- Words: Eric's rule in `docs/rules/eric.md` ("No URLs work" covers the whole device: Eric, Nov 13, "so be it"), the decision note's
  calls 1/3/4, the privacy text (a ban marks the device for everyone on it), the PR body's review round.
Typecheck, server/app unit tests you touch, `e2e/fairplay.spec.ts` both projects. Push; `.pr-body.md` (add a short "Eric's call" section
to the current body); `.done`. No PRs, no CI waits, no model names in commits. About 30-45 minutes; keep it lean.
