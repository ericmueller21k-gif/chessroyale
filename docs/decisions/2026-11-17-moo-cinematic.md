# Moo & Moon's Full Moon cinematic (Nov 17, 2026)

**Eric, Nov 17:** "he jumps down onto the center of the board, then the board and everything above it like the boss bar, is
replaced with a singular cinematic drawing of a field of grass with a starry night and a giant moon… a super close up of moo and
moon… their eyes start turning white, then it goes back to the first scene and this is where he does the transformation, then the
background fades… he hops back to his spot." On the close-up: "im fine if it just looks like a zoomed in version of the real ones".

**What changed:** the Full Moon's moment is `components/MooCinematic.tsx`, its beats in settings.ts (`MOO_CINEMATIC`, 7080 ms in
all); `MOO_BEATS.fullMoon.total` adds them up, so solo and the server wait for it while he thinks.

**Calls:** he lands where the field has its clear patch (the board's middle across, near its second rank). It covers, on a phone, the whole width from the screen's top to the board's bottom; on a computer, the board's column
from the top. The close-up is his rig's sprite (Moo 4x, the Moon 5x). The Moon's line comes as he lands back.

**Review fixes (the director's calls, Nov 17; review of #776):** while the field is up it takes taps, and an open match menu shows
above it (`body.mo-on .mm-scrim`). A Full Moon first seen within `rejoinMs` (1.5 s) of a rejoin (a reload or late join: the round
resent) is skipped, his swap noted as past: no protocol change. QUEEN SLAIN! on the same move plays first: the cinematic starts
`bossBannerMs() + 500` later and his think is the sum (`fullMoonMs`, solo and the server), plus `tailPadMs` (200 ms). In an area
wider than 4:3 his feet stay inside it, his scale is capped and the close-up fits. The boxes are read each frame.
