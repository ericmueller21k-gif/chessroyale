# A loading bar past a 2-second hang (Nov 10, 2026)

Eric: "Let's put a loading bar … But we should only do that if it's going to be more than like a 2-second hang. If it's just 1
second, then it can say hun chess." The bar lives in index.html's shell (it covers the app's own splash at load), shown after
`FRONT_DOOR.loadBarAfterMs`, moved by real steps (`loadbar.ts`: the script, sign-in, your account, "Almost there…"). Calls: in home's
shell it sits in the hero panel's middle (no centered logo there); "Try again" shows only on a failure (a script that won't load, or
no step for `loadBarStallMs`), hanging under the line so nothing moves. No engine step: home doesn't wait on the engine.
