# Chandy's checkmate way into Dodge: stills (Nov 26, phase 1)

- storyboard.png: beats 1-6 over a real battle screen, phone (390x844) above, computer (1536x730) below.
- pose-sheet-s5.png / pose-sheet-s0.png: every new pose, rifle fully upgraded and base, at 3x.
- gifs/: each animation (no suffix: base rifle; _s5: full rifle), from npm run preview:characters.
- tools/: the scripts that made these (frame dump, screen capture, sheet and storyboard).

## Phase 2 (Nov 26): wired, the collapse redrawn

Real battles, real taps (`?boss=chandy&win=1`: your Qxf7# mates him), captured at about 60 fps (CDP screencast):
- phase2/1-phone-collapse.png: flat on his front at the board's center, rifle dropped behind him.
- phase2/2-phone-zap.png: on his knees, the bolt from his claws to your king.
- phase2/3-phone-win-ko.png: the win beat, knocked out on the center file below "CHECKMATE!".
- phase2/4-computer-leap.png: mid-leap from his side spot onto the board.
- phase2/phone-opening.gif: the whole opening on a phone, from your mate to his line (about 20 fps).
- tools/mate-frames.spec.ts (put in e2e/, run with tools/pw-local.config.ts), mate-dump-phase2.ts, contact.py: how these were made.
