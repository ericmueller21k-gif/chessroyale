# Crate page: the Open button up top, tap the crate to open, colors open by default, bigger coins (Eric, Nov 27 ~06:10 UTC)

Read `notes/briefs/rules-common.md` first, then CLAUDE.md and `.claude/LESSONS.md`. Branch `claude/crate-page-open` from main.
Targeted lane (markup, CSS, one small pop-up, one stored preference). Haiku, effort high. Follow these steps exactly.

Eric's words (with his screenshot of a crate page: the item list, "Colors and purity" collapsed, "▶ Open · uses 1 key" at the very bottom):
"the open is kind of hiding down here... the colors and purity tab, we should actually have it by default be open and then collapsed if
you click it, and then it stays collapsed... if you just click on the box [the crate art], then it should give you the option to say
like use one key to open... a little pop-up in the same kind of like color scheme we've been using... the gold coins with how many you
have is like pretty small. I think we should make the coin itself bigger and the number a little bigger... when you're actually on a
crate page... make [Open] full width... that same width as that crate container... a bit less height than [the rows like 'Common supply
box']... it'll keep it same height as it already has at the bottom, but the width goes the full length... and then the text is centered."

Steps, all in `packages/app/src/screens/Crates.tsx` (`CratePage`, ~line 600-775) and `packages/app/src/styles.css` unless named:
1. **Move the Open button** (the `<button class="ff-button" ...>▶ Open · uses 1 key</button>` at the end of `CratePage`) to right after
   the `crate-hero` box (before `<h3 class="ff-title">{look.boxes}</h3>`). Keep its label, `disabled={!canOpen}` and onClick exactly.
   Give it a class `crate-open-btn`: `display: block; width: 100%;` (the same width as the hero box and the rows), its current height
   (don't change padding/font size), text centered. Do the same in `WelcomePage` (its "▶ Open" button: right after its hero box).
2. **Tap the crate to open:** in `CratePage`, when `canOpen`, the crate art in the hero (`<span class="crate-hero-art">`) becomes a
   `<button type="button" class="crate-hero-art crate-art-btn" aria-label="Open this crate">` (no visual change but `cursor: pointer`).
   A tap shows a confirm pop-up; when `!canOpen` it stays a plain span (the Open button below stays greyed, as now).
   The pop-up reuses `Confirm` from `../components/MatchMenu.tsx` (its look is the game's pop-up style) inside a new overlay
   `<div class="crate-confirm-overlay" onClick={cancel}>` (`position: fixed; inset: 0; display: grid; place-items: center;
   background: rgba(0,0,0,0.45); z-index` above the page and below the opening layer). Text: heading "Open this crate?", note
   "It uses 1 crate key." (a boss crate, `boss` set: note "You have N." with `heldWords`), go "Open". Cancel or a tap outside closes it;
   Open closes it and does exactly what the Open button's onClick does (unlockAudio, play("menuSelect"), setOpening(true)). Escape closes it.
3. **"Colors and purity" open by default, remembered:** the `<details class="odds-more">` gets `open` unless the player closed it.
   Store the choice in localStorage key `hunchess-crate-colors-closed` ("1" when closed), read once on mount, written in the
   details' `onToggle` (read `e.currentTarget.open`). Wrap every localStorage read/write in try/catch (as `UNSEEN_KEY` does at ~line 131).
4. **Bigger coins in the shop header** (`packages/app/src/screens/Shop.tsx` ~line 65, `.shop-coins` in styles.css ~6708): the coin
   about 1.5x its size now (pass a bigger size to `<Coin />` if it takes one, else size `.shop-coins .coin-icon`), the number one step
   bigger (about 20 px, still `font-weight: 800`, tabular). It must not push the tabs or the Back button: check at 320 px wide.
Tests: update `e2e/shop.spec.ts` / `e2e/crate-banner.spec.ts` / `e2e/welcome-crate.spec.ts` only where they depend on the old order;
add one focused check to `e2e/shop.spec.ts`: a tap on the crate art shows the pop-up, Cancel closes it, Open starts the opening; and
"Colors and purity" is open by default, closed after a tap, still closed after a reload. Run typecheck and just those specs (phone).
One still per platform (a phone 390x844 and a computer 1440x900, a series crate page) on branch `stills/crate-page-open` (never on the
work branch). `.pr-body.md` (at most 40 lines: what changed, player-visible, checks changed old → new), then push `.done`.
Docs: a 5-line note `docs/decisions/2026-11-27-crate-page-open.md`; `docs/areas/shop.md` updated where it describes the crate page.
