# Ride sounds: a hard start and stop (Nov 16, 2026)

**Eric:** "for all the noises/audio for the rides ... forget the fade in and out, it should be a hard start and stop when you start
moving and stop. Like boingo, it sounds better this way and not laggy."

**What changed.** A loop ride (the Dozer, the Mower, the Sled) starts at full level and speed on your first moving frame and stops
`holdMs` (120, kept) after your last. Gone: `fadeInMs`, `fadeOutMs`, `RIDE_SOUND.engine` (`startRate`, `upMs`, `stopRate`), each loop
ride's `engine` flag (it only chose those ramps) and the mid-fade comeback; moving again after a stop starts a new loop. The pogo is
untouched.

**Call made.** Each end still takes 30 ms (`DECLICK_S`, the Sound switch's out, now one constant for both ends): measured from the files,
a bare cut clicks (the Dozer's loop begins at -0.19 and about 40% of its samples are over half its RMS, while its samples step 0.005
apart), and 30 ms is well inside a 90 ms step. `holdMs` stays 120: a lower one (80) still bridges a dropped frame on a phone, but a tap
after you arrive is human-paced either way, and on CI's slow frames a lower one would cut the loop mid-walk more often.
