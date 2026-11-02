# Timber's attack on the God King (`kingAttack`)

Timber the beaver builder is the only boss with no attack on the God King. The other 14 bosses have one, and Eric found
it missing when he tested (Nov 2). It plays when the boss hits the God King (his Last Stand, or a mate), and from now on
also in each boss's challenge intro, just before the screen transition.

Your drawing exists and Eric approved it: **read it first**, `scripts/boss-art/out/boss-beaver/boss-beaver.ts`. Add to it
with `edit_drawing`. Don't rewrite it, and don't change any existing animation or part.

## What to add
**`BOSS_BEAVER_ATTACK: Character`**: Timber for his attack. It has his own parts and palette (spread `BOSS_BEAVER`, as the
other bosses' attack characters do), with id `timber-attack`.
- **Frame:** as wide and as tall as the attack needs. Give it room on the side toward the king for the hammer's reach, and
  above for his drop in. Move the foot to match.
- **Animations:**
  - `idle`: one still, for the preview;
  - `kingAttack`: the attack.

**Read how the others were done:**
- Big Boy's, the closest model: `packages/app/src/characters/bigboy.ts`, `BIGBOY_ATTACK` and its `kingAttack`. It drops
  in, lands, then delivers ten bonks on the beat, giggles and leaves.
- `packages/app/src/characters/folio.ts` (`FOLIO_ATTACK`).
- How the game plays them: `packages/app/src/components/KingAttack.tsx` and `KingAttackKit` in
  `packages/app/src/characters/kits.ts`.

**The beats are shared by every boss**: `KING_ATTACK` in `packages/chess/src/boss-timing.ts`. Import it with a relative
path (`../../../../packages/chess/src/boss-timing.ts`). Your frames' times must add up to its beats exactly:
- **Before 470 ms:** his shadow spreads on the ground, then he drops in from above (an empty frame or two first, as Big
  Boy's).
- **`landAt` 470:** he lands, with a thump, a squash and a puff of sawdust.
- **`lashAt` 560, then every 170 ms, 10 hits** (`lashes`, `lashEveryMs`): each hit lands exactly on its time.
- **`leaveAt` 2380:** a beat of his own (a buck-toothed grin and a chitter), then he hops off.
- **`ms` 2780:** the end. The last frame is empty.

## The attack, in his style
- **He's a beaver builder:** his red-handled hammer, his planks, his big teeth and his paddle tail.
- **Ideas:**
  - He lands, swings the hammer off his belt, and **hammers the king**, overhead whacks and side knocks in turn, with
    wood chips flying.
  - Mix in a **tail slap** or two (his flat tail swung round onto the king), or a plank swung like a bat.
  - Your call on the mix, as long as there are exactly 10 hits on the beats.
- **Facing:** decide which side the king is on, his hammer paw's side, and say so (the kit's `facesLeft`). The game
  mirrors him when the king is on his other side.
- **Look:** he's fierce but cartoonish, like the others' attacks (Big Boy goes red-faced).

## Sound cues
Put a `cue` on the frames where a sound belongs, using **his own sound names** from
`packages/app/src/characters/timber-sounds.ts`: `gnaw`, `chomp`, `clack`, `knock`, `pat`, `tap`, `whack`, `saw`,
`thump`, `clatter`, `slap`, `swoosh`, `slide`, `chitter`, `oof`, `hup`, `burp`. For example:
- `swoosh` as he drops;
- `thump` on landing;
- `whack` for an overhead hammer hit and `knock` for a side hit;
- `slap` for a tail slap;
- `chitter` for his laugh;
- `hup` as he hops off.

List every cue with its frame and its time in your notes.

## Its numbers for the kit
Tell the code helper, in your notes:
- `perSquare`: frame pixels to a board square. It's 36 for most bosses; check what suits his size next to Big Boy's.
- `stand`: how many squares to the king's side of the king's square his feet go. That's 1 to 1.9 for the others: his
  hammer's reach decides it.
- `facesLeft`.
- What his hit on the king's square should look like (code draws it, for example a burst of wood chips, as Sawyer's
  `sawItem` in `packages/app/src/characters/power-art.ts`). Draw nothing for it.

## Looks
- Render `kingAttack` frame by frame at 2x on both backgrounds. Check that:
  - the hits read clearly;
  - the hammer and tail stay inside the frame;
  - the motion is smooth;
  - he's the same beaver as in his other animations.
- Then render `idle` beside Big Boy (`with: "bigboy"`) to check his size.
- Keep each render under 3,000 px wide (at most about 8 frames side by side at 2x).

Call done with notes: the frame size and foot, the frames beat by beat with their times, the cues, `perSquare`, `stand`,
`facesLeft` and the hit effect you suggest.
