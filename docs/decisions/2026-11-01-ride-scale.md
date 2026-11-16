# Rides: a size per ride, and an admin switch to try sizes (Nov 1, 2026)

Eric (Nov 1): "Is there any way to simply scale down the riders with just a button so to speak like this cricket is too damn big I
wanna see it at 75%".

- **What changed:** `RIDES.scale` in core's settings, one number a ride (Riding Chirp and Moon's Ride both 1 until Eric picks), and
  `?rideScale=K` (0.5 to 1.25, a test switch: admins on the live site) to try one size for every ride on a page. Everywhere a rider is
  drawn: the town (Canvas 2D and WebGL), the locker, the profiles, home's pawn and ring.
- **The director's call:** every pawn stays its size; only the ride shrinks. It's scaled about its saddle (the middle of the seat's cut
  line on its first idle frame); on every frame the pawn's seat moves with the scaled saddle (its cut line's middle, tilt included,
  lands where that point of the saddle went), so the same share of the pawn is hidden in it; the ride's feet stay on the square, so the
  pawn sits lower on a smaller ride. Its hop and the grasshopper's shadow scale too. Worked out once as a rider's frames are composed.
- **Calls made:** in the locker, profiles and home the box and the pawn's size in it stay as at 1 (the square shown grows only if a
  ride drawn bigger than 1 needs it), the ride standing on the box's foot. The item's own tile (`ItemArt`) keeps 1: it's the item's
  picture, framed on the drawing. A rider drawn bigger than 1 is drawn from further off the screen's sides (1.5 × K squares), so it
  never pops in. The switch is read once as the page opens; riders are shared by size too, so riders made before an admin's account
  loads (the switch counting only then) and after don't share frames.
- **Frame rate** (eric.md's method: headless, `?crowd=50` by day, 5 s walking, medians of four runs in turn, riding Riding Chirp;
  main 51c018e0): phone 390 × 844, main 47.6 fps (JS 3.26 ms, task 20.9) / branch at 1 49.1 (3.00, 20.4) / at 0.75 48.4 (2.99,
  20.7); computer 1440 × 900, 54.1 (3.13, 18.4) / 52.3 (3.35, 19.0) / 48.1 (3.72, 20.7). The computer's 0.75 had two runs under a
  busy machine (44.0, 43.2 against 52.3, 55.9), so the computer was measured again: 37.7 / 38.1 / 40.6 fps (the machine busier
  throughout). Level with main: the town still draws one picture a rider, a smaller one at 0.75.
