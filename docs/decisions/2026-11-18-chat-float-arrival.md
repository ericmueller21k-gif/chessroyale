# An emoji's float counts from its arrival (Nov 18, 2026)

**What happened:** main's full run on 6ed5647 went red: Eric's guard `e2e/chat.spec.ts:81` ("quick chat picks in the profile … exactly those
lines in a match") passed only on its retry, waiting for `.tower-side .t-float` (an emoji floating over its sender's row) that never showed.

**Cause:** `MatchChat.floats()` showed an emoji for `emojiFloatMs` (2.4 s) from the line's server stamp, mapped to this device's clock
(`host.local(at)`). A delivery late by a second or two, or the device's estimate of the server's clock off by as much (a busy runner, a phone
on a slow network), left the float over before it arrived: it never showed. Not the spec: the app.

**Fix:** a line's float counts from when it arrived on this device (`floatFrom`, the later of its stamp and now), and the redraw that ends it
is set from then. The guard test is unchanged.

**Check:** `chat.test.ts`: new "an emoji floats its whole time from when it arrives, even stamped seconds earlier" (fails on the old code).
