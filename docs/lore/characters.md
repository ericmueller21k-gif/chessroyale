# Characters: lore, powers and voices

Eric (Nov 21, 2026): "keeps a file on every single boss or every single thing in the game, like the clerk included, everything
that talks and kind of a description of what it is and like the lore behind it."

This is the knowledge base's character file. One section per character that talks (or will). Each section says what the
character is and how it looks, its personality and voice, its powers (one plain sentence each), any relationships the game
already hints at, and 3 to 6 of its **existing** lines as voice samples.

**How to read the lore lines.** Each boss's lore says where it comes from:
- **Eric's words** means Eric wrote or said it (with the date, from the decision note or the code's header).
- **Sketch** means nothing about its backstory is written yet; the line is drawn from its look and its existing lines.
  Sketches wait for Eric's approval before they go in-game (the boss-select decision: "new ones from each boss's lore wait
  for Eric").

Lines are quoted exactly as the game has them (`characters/*-lines.ts`, `SELECT_LINES` in `characters/boss-select.ts`,
`TOWER_WORDS` in `tower.ts`). The new tower banter and the clerk's lines live in `packages/app/src/characters/tower-banter.ts`.
They are not wired into the game yet.

Names are the game's own spelling. The Hidden Boss is the one exception, below.

Pronouns follow the game's own text or Eric's notes where they say; otherwise the section uses the name.

---

## Tower bosses (the Battle Tower's pool, 14 playable bosses)

These are the bosses the Battle Tower deals from: `towerPool()` in `packages/core/src/tower.ts`, which is every playable boss
in `BOSS_ROSTER` (`packages/core/src/boss.ts`) that isn't admins-first or the Hidden Boss.

### Ginger (`gingerbread`)

- **Is:** an angry gingerbread man with white icing trim, a green bow tie, red gumdrop buttons, and a big candy cane he holds
  like a weapon. He's the Freeze boss, so his icing glints like frost and his eyes go ice-blue.
- **Lore (Eric's words, Oct 25, `2026-10-25-ginger-lore.md`):** he escaped from being baked in Santa's workshop (the oven was
  going to kill him, so he hates the heat), got out through the North Pole, fell into the cold and was infused with it. So
  he likes cold things, though not to excess. Eric: "kind of basic, but I like it better... he also is kind of silly clearly."
- **Powers:** *Freeze* (passive): from a set turn, one of your three most valuable mobile pieces (never your king) is iced and
  can't move for a few turns, then again on a schedule. *Blizzard* (ultimate): a storm freezes most of your pieces for a few
  turns, leaving only a handful free.
- **Relationships:** none written yet.
- **Voice (existing lines):** "Ginger is here!" · "You'll crumble!" · "Fresh out of the freezer!" · "Cold move. Colder heart." ·
  "Crumbs to crumbs!"

### Boingo the Clown (`clown`)

- **Is:** a grinning harlequin, always bouncing on a pogo stick, with a showman's face and big gloves that hold the handlebar.
- **Lore (sketch):** a showman who can't stop bouncing into the fight. Honks, loves an audience, thinks every game is a show.
- **Powers:** *Pie* (passive): from a set turn, every few turns he throws a pie at one of your pieces (never your king) whose
  two squares behind it are empty. *Funhouse* (ultimate): the board turns upside down and he plays your move for you, a weak
  but recoverable one.
- **Relationships:** none written yet.
- **Voice (existing lines):** "Honk honk! Showtime!" · "Step right up!" · "Who ordered a clown?" · "Your turn, chumps!" ·
  "Mine now! Honk!"

### Jefferson (`grex`)

- **Is:** a cocky giraffe, yellow with orange-brown spots, flames on the tips of his horns and down his mane and tail, a cheeky
  grin, and a sparkler in each hand. (His roster icon is a dinosaur, a leftover from G-REX, the name until Oct 10; the art is a
  giraffe.)
- **Lore (sketch):** a show-off with a mischievous look and a fiery glint. Thinks he's the hottest thing on the board.
- **Powers:** *Sparkler* (passive): from a set turn, a square on your half catches fire and burns in stages, one stage a turn;
  a piece of yours still on it on the last stage burns. *Roman Candle* (ultimate): fireballs fly in waves, one wave a turn,
  and some of each wave lands on his own side.
- **Relationships:** none written yet.
- **Voice (existing lines):** "Jefferson in the house!" · "Feel the heat!" · "Too hot to handle?" · "Watch and learn." ·
  "Rawr! I mean… hi."

### Hollow (`hollow`)

- **Is:** a lanky, shaggy creature of charcoal-black fur. A band of violet-black darkness runs through his middle, with a void
  at its heart, slowly swirling. Torn seams across his shoulder, cheek and thigh are bound the same way. He carries a strand of
  Christmas lights, two halves of five bulbs each.
- **Lore (Eric's own, per the Oct 16 boss-select decision):** "The villagers tore him apart; the darkness brought him back and
  holds him together." (From `characters/hollow.ts`.)
- **Powers:** *The Dark* (passive): after his first move he covers the square of the piece he moved, then another square every
  few of his moves; each stays dark for a few turns. *Lights Out* (ultimate): at the start of his turn, a memory test in
  rounds: you find his pieces in the dark.
- **Relationships:** none written yet.
- **Voice (existing lines):** "Hollow is here." · "Did you leave a light on?" · "I was always here." · "Into the dark." ·
  "Gone. Like you'll forget." · "Hush now."

### Big Boy (`bigboy`)

- **Is:** a chubby bald baby with a few hair tufts, big ears, half-lidded eyes and big pink lips. A teal crop shirt reads "BIG
  BOY", a light-blue diaper, bare feet, and a swirly rainbow lollipop (his weapon) in one hand.
- **Lore (sketch):** a spoiled, greedy baby who wants every toy in the room. Simple words, big feelings.
- **Powers:** *Toy Tower* (passive): from a set turn, a toy block lands on an empty square of your half, and every turn after
  he stacks one more on it, up to a top. *Big Bounce* (ultimate): after a warning, a few of your pieces (never the king)
  bounce to empty squares nearby.
- **Relationships:** none written yet. He eats one of the crowd's center pawns before move 1 (his snack, in the roster's note).
- **Voice (existing lines):** "Big boy here!" · "Wanna play?" · "Mine! All mine!" · "Mine! Give back!" · "Big boy BOUNCE!"

### Sawyer (`sawyer`)

- **Is:** a raccoon in a wide, aggressive stance, a toothy grin, a yellow hard hat, a bold black bandit mask, white gloves, and a
  big striped tail. He holds a red-and-black reciprocating saw in both hands.
- **Lore (sketch):** a rowdy, handy demolition raccoon who saws his way out of anything. Hard-hat safety talk, a lot of pride
  in his cuts.
- **Powers:** *Saw Cuts* (passive): from a set turn, every few turns he saws the edge between two squares in your half that one
  of your moves would cross, for a few turns. *Board Saw* (ultimate): once his meter is full, and while one half of the board is
  his on material, he saws the board across the middle for a few turns; no move may cross the cut.
- **Relationships:** none written yet.
- **Voice (existing lines):** "Measure twice, cut once." · "Hard hat zone!" · "Let's get sawing." · "Double trouble!" ·
  "Pardon the renovation!"

### Wrangler (`pig`)

- **Is:** a pink pig in a wide fighting crouch, a brown cowboy hat with a gold star, a fringed brown vest, a belt with a big gold
  buckle, boots with gold spurs, and a lasso spinning overhead. (Eric named him Oct 13. His code id stays `pig`, since
  "wrangler" is already Cloudflare's CLI in this repo.)
- **Lore (sketch):** the cowboy who rounds up livestock, and he's proud of it. Angry brows, a scheming grin.
- **Powers:** *Lasso Drag* (passive): from a set turn, every few turns, after his move he ropes one of your pieces (never your
  king or a bishop) and drags it one square onto an empty square. *SHOWDOWN!* (ultimate): he has a meter of his own; when it's
  full he calls a forced duel that costs you a piece unless you find the answer.
- **Relationships:** none written yet.
- **Voice (existing lines):** "Howdy, varmints." · "Giddy-up, pawn!" · "Reach for the sky!" · "Dang varmints!" ·
  "Easy pickin's."

### Alfil (`alfil`)

- **Is:** a shaggy brown woolly mammoth standing on his hind legs in a fighting stance, big curved ivory tusks, a trunk with a
  curl at its tip, and a red-and-blue caparison with gold tassels. In one fist he holds the ankus he took from his rider.
- **Lore (sketch):** the old piece is back. Named for the alfil, the elephant piece in old Persian and Arabic chess and the
  bishop's ancestor, so he's proud of the lineage and the bishop is his younger cousin.
- **Powers:** *Tusks* (passive): on a set turn, then every few turns, two of his pawns glow; if you don't take one, they fuse
  into an elephant bishop, and the fusion is his whole move that turn. *Mammoth Slam* (ultimate): after a warning he slams the
  board and some of your pawns and minor pieces are thrown into the air for a few turns.
- **Relationships:** none written yet.
- **Voice (existing lines):** "Before your bishops, there was me." · "The old piece is back." · "Old school wins." ·
  "Two pawns, one big problem." · "Make room. Big guy coming through."

### Chub & Chirp (`hopper`)

- **Is:** two friends drawn as one figure. Chub, a brown rabbit with a cream chest, a cotton tail and a green scarf, sits on the
  back of Chirp, a grasshopper with a big black eye and long antennae. Eric: "a cute rabbit and grasshopper, they are friends.
  Just one sprite."
- **Lore (sketch):** best friends with one saddle and big plans. Chub does the talking and the reins; Chirp does the hopping.
- **Powers:** *Leapfrog* (passive): when one of his pawns stands nose to nose with one of yours and the square beyond yours is
  empty, Chirp hops his pawn over yours. *Carrot Patch* (ultimate, once a battle): five carrots go on empty squares, a race to pull
  them, then his spin.
- **Relationships:** a pair, best friends. Speak as two, or as Chub for both.
- **Voice (existing lines):** "Chub and Chirp, reporting for hops!" · "Got any carrots?" · "Ready, Chirp? (Chirp!)" ·
  "Two friends. One saddle. Big plans." · "Nice and springy."

### Smudgy (`smudgy`)

- **Is:** a lime-green chameleon with a casque striped orange, teal and green, the same stripes on his arms, legs and spiral tail,
  big amber eyes, a friendly smirk, a deep-plum painter's beret, a cream apron splashed with paint, and a big brush.
- **Lore (Eric's words, Oct 19):** "he learned painting because he always struggled to blend in like the other chameleons."
- **Powers:** *Camouflage* (passive, once a battle): his first two moves are always the same (an end pawn two squares, then the
  rook out through the gap), and then his rook swaps with one of his pawns and hides as a pawn until it strikes. *Repaint*
  (ultimate, at most twice a battle): after a warning he paints one of his pawns your color and one of your knights or bishops his,
  and that's his whole turn.
- **Relationships:** none written yet.
- **Voice (existing lines):** "Chameleons blend. I stand out." · "Artist at work. Wet paint!" · "Hold still. I'm painting you." ·
  "Needs more yellow." · "A masterpiece, if I say so myself."

### Moo & Moon (`moo`)

- **Is:** a round, soft Holstein calf, cream with dark-brown patches, pink snout, floppy ears, small tan horns. The Moon is his
  friend, a crescent moon with a face.
- **Lore (Eric's words, Oct 20):** "he was a lonely cow who always wanted a friend; the moon was always looking down, curious
  about the farm animals, and now they're buddies. The cow doesn't talk (he's a cow); the moon does, and Moo answers with
  moos. He's called Moo because that's what the moon always heard him say."
- **Powers:** *Moonbeam* (passive): after every few of his moves, a beam of moonlight lands on one of your pieces at the end of his
  turn; it glows, a crescent is burned into its square, and it can't move on your next turn. *Full Moon* (ultimate): his fur
  turns gold and flames flare round him; for five of his moves he plays at full strength, and the first of them ends with a flurry
  of five beams.
- **Relationships:** the Moon is his best friend, and the Moon is the one who talks.
- **Voice (existing lines):** "Hi! I'm Moo, best friend." · "I watched your farm. Let's play!" · "Moo, look! Little horses!" ·
  "Ooh, good one, Moo!" · "Easy does it, buddy."

### Puddles (`gardener`)

- **Is:** an upright hippo with realistic proportions (a heavy barrel body, short thick legs, a big square muzzle with a soft smile,
  small round ears) in pinkish grey, with a pinker belly and throat. No clothes; he holds a garden hose in both hands, with a
  brass-and-green nozzle.
- **Name:** Puddles (named Oct 21). Eric's first note: "a hippo who waters plants and plants seeds."
- **Lore (sketch):** a gentle gardener who grows things on a schedule of his own. Speaks slowly and warmly; when he greets you he
  uses a quick, made-up hello.
- **Powers:** *Seeds* (passive): five seeds go in as the battle begins, then one more every 30 seconds of real time, up to 10
  waiting. *Watering* (ultimate): at the start of his turn he waters the board, and every waiting seed comes up: a plain plant
  that blocks a square, a killer plant that eats a piece, a piece grown for him, or the queen jackpot.
- **Relationships:** none written yet.
- **Voice (existing lines):** "Mind the flower beds." · "Good soil here. Very good soil." · "Keep off the grass." ·
  "Take your time. They grow either way." · "Everything's coming up roses."

### Babur (`tiger`)

- **Is:** a circus tiger on all fours: orange with black stripes, a cream chest and muzzle, amber eyes, a small black top hat with
  a red band, and a red-and-gold ringmaster's vest. (Named Babur Oct 24; his code id stays `tiger`.)
- **Lore (Eric's words, Oct 23):** "a circus tiger who hated his role, the loud roaring and jumping through hoops, and wanted to
  make the silly balloon animals he saw someone making."
- **Powers:** *Balloons* (passive): at the start of his turn, if his pump is empty, he puts a new balloon on it. It blows up in
  stages, then at the end of a turn lands as one of his pieces where the engine takes the least valuable safe square, or it
  pops (about 58% pop). *Hoops* (ultimate): after his move, he throws three burning hoops onto the board. Their walls nothing
  crosses, moves, captures or checks, for the crowd's next two moves.
- **Relationships:** none written yet.
- **Voice (existing lines):** "No roaring tonight. Balloons only." · "Ugh. Another crowd." · "Step right up. Or don't. I'm on
  break." · "Shh. Creative process." · "Nobody goes through my hoops. Not anymore."

### Folio (`folio`)

- **Is:** a paper crane folded from a single page of handwriting. Blue-black cursive runs along its large faces, and three lines
  on its near wing come and go. It hovers just above a soft shadow. Folio is "it" everywhere in the game.
- **Lore (the director's boss, Oct 26):** gentle, graceful and warm. It means its compliments, never gloats, and tells the truth.
- **Powers:** *Draft* (passive): from a set turn, every few turns, it writes an ink mark under one of your most valuable pieces that
  one of its pieces attacks; the mark folds the piece for a few turns unless you answer it. *Crease* (ultimate): the board is
  folded along one line that your pieces can't cross, for a few turns, shown the turn before. *Revision* (once a battle): when your
  reply punishes one of its blunders, both moves are crossed out and its engine's best move goes in their place.
- **Relationships:** none written yet.
- **Voice (existing lines):** "Every game's a draft. Write one?" · "I'll be honest: that piece is next." · "Mind the crease." ·
  "Well played. Keep the crane." · "Let me write that again."

---

## Admins-first bosses (not in the tower yet)

These are complete characters, live for admins first (`BOSS_ADMIN_FIRST` in `packages/core/src/settings.ts`). They don't
deal in the Battle Tower yet (`isPlayable` leaves them out). When Eric says go, each one joins `towerPool()` and needs its
banter; the test in `packages/app/test/tower-banter.test.ts` will fail until it does.

### Timber (`timber`)

- **Is:** a stout brown beaver builder in an orange hard hat, standing upright. (Eric's design; the art approved Nov 1.)
- **Lore (sketch; Eric's design, Oct 20 and Nov 1, gives the look only):** a builder who takes every job seriously. Careful, measured, proud of the work.
- **Powers:** *Scraps* (passive): his workshop, a strip in his bar, builds pieces from scraps (a pawn, a knight, a bishop, a rook,
  a queen), and each finished piece is dropped onto an empty square of his half. *Gnaw* (ultimate): after a warning he plays his
  move, then gnaws one of your pawns, at random, and that makes scraps for his workshop.
- **Relationships:** none written yet.
- **Voice (existing lines):** "Hard hats on. We're building today." · "Measure twice, checkmate once." · "Got wood? I've got plenty." ·
  "Square and level." · "Nice and plumb."

### Dash (`dash`)

- **Is:** a lanky, cocky cheetah in a backwards orange cap and a teal-and-orange track jacket, with a chess clock under his arm
  (ticks, never numerals). His sidekick is **Tick**, a sleepy tortoise with the clock on its shell.
- **Lore (Eric's design; the decision note, Nov 3, `2026-11-03-dash.md`, describes him):** "a bit silly, trying way too hard with
  the younger crowd's slang, a sneaker hustler; friendly-cocky, never mean." The name is Dash, not "Blitz" (a chess time control,
  too confusing).
- **Powers:** *Clock Slap* (passive): every time he takes one of your pieces he slaps his clock and steals your time. *Time
  Scramble* (ultimate, a set number a battle): after a warning, your next five moves get three seconds each. Out of time
  against him is never a loss: a random legal move is played for you.
- **Relationships:** Tick, his sidekick, a tortoise who is much slower.
- **Voice (existing lines):** "Yo yo yo! Dash in the building, fam!" · "Too easy, bro." · "That piece? Chopped. Fully chopped." ·
  "Ayo, what size? Asking for a friend." · "Bet. Let's run it, broski."

### Don Dough (`zebra`)

- **Is:** a zebra with a big pudgy belly, standing upright as the giraffes do. He runs a bakery like a mob: "just a bakery."
- **Lore (Eric, Nov 10 to 11, `2026-11-11-don-dough.md`):** a zebra kingpin who runs "just a bakery." Eric's design; the art
  approved Nov 11: "Art looks great."
- **Powers:** *Rising Dough* (passive): a few times early in the battle he drops a lump of dough on an empty square of his half.
  Each lump shows what it will rise into when its oven timer runs out, unless your piece lands on it first (squashed). *Gold
  Plate* (ultimate, a set number a battle): after the warning, at the start of his turn, his queen (or else his strongest piece)
  turns gold, and your pawns can't take it for the rest of the battle.
- **Relationships:** none written yet.
- **Voice (existing lines):** "Nothing here but a bakery." · "You want a game? Sit down, kid." · "Pop! Ha! Relax, it's just a roll." ·
  "Into the bread basket." · "That one's mine now."

### Chandy (`chandy`)

- **Is:** a special-ops alligator, green, standing upright on two feet, slim, with a cream belly in scale bands and a long ridged
  tail. His energy rifle grows as the battle goes on.
- **Lore (Eric's idea, Nov 15; design approved Nov 16):** the look is Eric's. The backstory is a sketch: a cool, patient operator
  who tells you what he's going to do and then does it.
- **Powers:** *Lock-on* (passive): nothing is locked until he takes your pieces. On his first few captures, his crosshair snaps onto
  a piece before he takes it, and each lock upgrades his rifle. The five upgrades each unlock one move (scatter shot, beam,
  shields, rapid fire, queen lock) that his move meter fires every few of your moves. *Dodge* (ultimate, once his rifle is whole):
  your king is left on a blank board; over a few rounds you vote where it stands, and his clones aim along the edges, so only one
  square is safe. A hit cracks your king, and a second hit loses the battle.
- **Relationships:** none written yet.
- **Voice (existing lines):** "You're already in my sights." · "Hold still. This won't take long." · "Hm. Missed that one." ·
  "You moved. Rude." · "Breathe in. Breathe out."

---

## The God King

- **Is:** the crowd's champion in every boss battle (the raid, the Crowd's boss final, and solo's Boss alone). He stands in the
  dock under the board, and his words come from a speech bubble. He can be called to act. The shop sells God King effects: the
  color of his bolts, his beam and his halo.
- **Lore (sketch):** the crowd's own champion, the one who "fights beside you." Steel and courage, a king who knows a queen is worth
  more than his crown. He is secondary to the chess: big moments are rare and short.
- **Powers (his calls):** *Play this move*: he plays the best move for the crowd, with his bolt. *Strike the boss*: three bolts and
  slashes on the boss's king; the boss's next move is weakened, and its rage meter gains a little. *Last Stand*: his save for a
  lost position. Rules and numbers are in `docs/areas/god-king.md`.
- **Relationships:** none written yet. He fights on the crowd's side against every boss.
- **Voice (existing lines):** "My blade is yours. Tap me when it counts." · "A boss? I've toppled taller towers." ·
  "Think twice, move once. I'll guard the rest." · "Mind your queen. She's worth more than my crown." · "Patience and steel.
  That's how bosses fall."

---

## The Clerk (Battle Tower)

- **Is:** a penguin bellhop, behind the low slate counter at the back left of the Battle Tower's lobby, before a key rack. He
  is the game's own sprite (drawn at his art's size). His name tag and card say "Clerk."
- **Lore (sketch):** a friendly bellhop who runs the tower's desk. He wants you to have fun up there and asks how it went when you
  come down.
- **What he does:** his card starts or continues your climb (solo, or your party's climb played alone), shows the open parties to
  join, and holds the "Best floors" board. A climb has two lives; the third loss ends it.
- **Relationships:** none written yet.
- **Voice (existing line, from `TOWER_WORDS.climb`):** "How high can you climb? Two lives: the third loss ends it." The lines
  for going up, coming back down (won or lost), a run's end and a first visit are in `CLERK_LINES`
  (`packages/app/src/characters/tower-banter.ts`), not wired yet.

---

The Hidden Boss (secret; not in the tower; no banter)

---

## Other town keepers

The town's shop keepers (the shop kids in `packages/app/src/town/shops/shops.ts`) have names and rooms but no lore file yet.
They'll get sections in a second pass.
