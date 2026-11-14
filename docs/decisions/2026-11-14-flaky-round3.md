# Flaky round 3: the causes (Nov 14, 2026)

Eric, Nov 13: "fix the cause, not add a checker". Each test asked first: is the game wrong, or the test?

- **Game: a quick tap a busy frame took for a run** (town-street:227, Eric's guard; red on main b0fbd8a, both tries). Round 2's
  reading was wrong: Playwright 1.56's `touchscreen.tap` already sends start and end together (`Promise.all`). The press is stamped with
  the event's own time, and the frame's hold check compares it to `performance.now()`: on CI (about 450 ms a step) the pointerdown was
  handled late and a frame ran before its pointerup, so the tap became a run and you ran to Alfil's door with no card (the trace: you at
  37,16, no card). A real slow phone does the same. Now the release's own time decides (`Press.up(key, at)`): a run only the frame
  made, released before `streetHoldMs`, is a tap, on what the finger pressed (the run had moved the camera under a still finger: that
  was the second half, a "cancel"). Proved with a CDP touch whose release is stamped 30 ms after its start and sent 400 ms later: main
  2/2 failed, now 3/3 (four such taps each).
- **Game: a status answer the banner never heard** (kill-switches:109, with the font preloads). `useServerStatus` and `useAccount`
  subscribed in a `useEffect`, after the paint: an answer between the first render and the effect had no listener, so the banner
  stayed away until the next minute's ask. The preloads only moved the first answer into that gap. Both hooks now draw a change made
  in it; the preloads are back in `index.html` (they were described as there in hub.md and the Nov 14 note, but never reached main).
- **Test: the old line's number read twice** (town-chat:1054, not a guard). The chat's submit answers after a promise, so right after
  Enter the first gray line was still there; it now waits for the line to change before reading N.
- **Not fixed, written up: fairplay:65** (Eric's ban guard). The failing attempt's page (the only record: CI keeps the retry's trace)
  is home with no profile ("Player") while the server answered: `loadAccount` took its "no server" path, so its config or /api/me
  failed. Which, and why, is not known. A route handler that throws fails the test with its own error (tried), so not that.
- Many other stores subscribe in a `useEffect` the same way (`match.subscribe` in hooks.ts, Duel, BossParty, SquadsParty, Home's party,
  App's squads/party/away): the same gap. Not changed here (match code, a bigger lane); listed for the director.
