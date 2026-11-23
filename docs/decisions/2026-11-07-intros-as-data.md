# Boss intros as data: one beat timeline (Nov 7, 2026)

Eric (Nov 6, on the audit): "it shouldn't be this complicated … something has gotten bloated." The audit's §5 item 1: intros as a generic beat timeline with one player, so a new home stops editing the shared engine (28 to 1,084 lines a home).

- **The call:** `shops/timeline.ts` plays beats of acts per actor (play, loop, hold a frame, flip, show/hide/for, move with ease and hop, lift, cue; frame cues to the beat's end); each boss's intro is its own file, `shops/intros/<boss>.ts`, with its art; ShopRoom draws any of them with one `drawCast`. Alfil's, Big Boy's, Timber's and Smudgy's moved; their special fields left challenge.ts, intro.ts and ShopRoom.
- **Proof, not looks:** each moved intro's beat log (every ms: step, lines, props' frames, places; its cues and beats) recorded on main is matched exactly (`test/intro-timeline.test.ts`). Nothing on screen changed, so no stills.
- **Kept:** CHALLENGE_FEEL's numbers (`log`, `smudgy`) stay in the one feel table; the e2e hook keeps its names (each intro's `view`).
- **Not moved yet** (each needs a beat kind first): Hollow (lights going out, motes, the dark pass), Wrangler (rope lines and arcs), Jefferson (a crew walking routes, your lift), Ginger (an arc, carriers on a route), Dash (off screen and back, per-dash props), Folio (a plane on a route, flat sheets, the crumple's hand-over), the default (pop and puff).
