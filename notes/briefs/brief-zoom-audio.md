# Brief: inside-house default zoom, and sound lost after switching apps on iPhone

Worktree `/home/user/cr-zoomaudio`, branch `claude/zoom-audio` (from main 5fd736a). Opus high. Push as you go.

## 1. Inside a home: start at the further-out zoom (Eric, Nov 3)
"When you walk into the house, the zoom should be the further out of the two by default, and when you challenge the boss, so you
can see everything." Today a shop starts in Close (the third-person camera, `SHOP_FEEL.close`; decision
`docs/decisions/2026-11-02-shop-zoom.md` said Close is the default; Eric now reverses it) and the −/+ switch to the town's
zoomed-in camera; a challenge uses its own wider framing (#468: zoom 0.8). Make going into ANY home start at the further-out of
the two cameras (the town's zoomed-in camera, zoom index 1), with + still taking you to Close. A challenge: the same further-out
view (keep #468's challenge framing if it's already at least as far out; make sure everything is in view on a phone and a
computer). Record the reversal in a decision note. Update tests that pin the starting zoom (old → new).

## 2. iPhone: no sound after switching to another app and back (Eric, Nov 3)
"I challenged him, surrendered, went to the Claude app, then back to HunChess: the audio is gone. I challenged Big Boy again
and still no audio. I've noticed this pattern whenever I switch away and come back."
Likely iOS Safari: the WebAudio context goes to `suspended` or `interrupted` when the page is hidden or the app is backgrounded,
and isn't resumed (`packages/app/src/sound.ts`: `play()` returns when `ctx.state !== "running"`; `playOnTap`/`unlockAudio`
resume only on some taps). Fix it robustly:
- On `visibilitychange` (visible), `pageshow`, and `focus`, and on the next `pointerdown`/`touchend`/`keydown` after any of
  them, try `ctx.resume()` when the state isn't "running" (iOS only allows resume inside a user gesture, so the gesture path
  matters most).
- If the context stays `interrupted` or `closed` (or resume rejects), make a new AudioContext and master chain, and re-warm the
  sound buffers (the worker cache is keyed by sample rate).
- Also check any `<audio>`/HTMLMediaElement sounds (the piece sounds in public/sounds/) recover the same way.
- Don't play a burst of queued sounds on return.
Add unit tests with a fake AudioContext (states suspended → running, interrupted → new context), and an e2e that simulates
`visibilitychange` hidden → visible and checks a later sound plays (the test log `window.__soundLog` shows the state).
Say plainly what you could and couldn't verify without a real iPhone (Eric will test on his phone).

## Done
PR-body file `docs/zoom-audio/pr-body.md` (every player-visible change, changed checks old → new). Stills: a shop's first view and a
challenge at the table on a phone. Push; no PR.
