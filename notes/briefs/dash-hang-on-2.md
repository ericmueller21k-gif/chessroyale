# Dash's "Hang on", round 2 (Eric, Nov 26 morning, after playing it)

Eric's words: "He doesn't, like, lean back and put his head up and, like, look... And he doesn't even press it. I wanted him to press it
even faster somehow than, like, he's ever pressed it before for the last few seconds. ...he should jump onto the middle of the board when
he does it, as well. ...he should have his head like up and then like lean back, so clearly his like mouth is pointed up into the air...
he wasn't pressing it. He needs to press it. This would be the fastest during any of them that he presses it. Like, it's a ridiculous
speed for a few seconds when he says cheetah speed... the whole thing should have lasted like a few more seconds. It felt sort of like it
went too quick too."

Scope: only these five. Nothing else changes (not the other Dash follow-up nits).
1. He visibly presses his clock through the gag (slow smacks speeding up, then cheetah speed). In Eric's real game he didn't. Find the
   cause first (watch it frame by frame with real taps, `npm run frames:boss`, phone and computer, solo Boss alone and a raid): e.g. the
   hang anims never chosen, overridden by the thinking loop, hidden with his figure, or the paw moving too little to read. Fix that cause.
2. Cheetah speed: the fastest he ever presses, faster than every other smack of his (pop-off fit10, the multi-hit, rush, stall slam):
   "ridiculous speed", lasting a few seconds.
3. Head up and leaning back, mouth clearly pointed up into the air during cheetah speed: an unmistakable pose at game size, not subtle.
4. He jumps onto the middle of the board for it. Director's call (record in the decision note): he jumps to the board's center with his
   clock as "Hang on" begins, does the whole routine there, and zips back to his spot after "Here's your time back", before his move.
   Reuse an existing jump/zip (Chandy's mate jump to the center, Dash's own zips) before writing new. Never cut off by the screen edge.
5. Longer: a few seconds more in all (today 12.6 s from your move to his): mostly a longer cheetah burst. All in DASH_HANG_ON
   (settings.ts); his thinking waits for it (popOffMs) solo and online, so the server timing follows the settings.

Lane: boss lane (targeted e2e of dash, the boss kit). Update the Dash e2e checks to the new timing; add one focused check that his
figure is over the board's center during the gag and that cheetah speed's smack is quicker than every other smack setting. One set of
stills/GIF at the end (phone and computer: the jump in, cheetah speed with head up, zip back) for the director. Decision note about five
lines. Update docs/areas (Dash's area page) if it describes the gag.
