"""Builds the Gemini prompt for the boss line packs (Nov 1). Run: python3 -I build.py (from this folder)."""
import json, re

HERE = "/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/lines/"
sheets = open(HERE + "sheets.md").read()
existing = json.load(open(HERE + "existing.json"))

def sheet(name):
    m = re.search(r"## " + re.escape(name) + r"[^\n]*\n\n\*\*(.+?)\*\*\n\n(.+?)\n\n- \*\*Voice:\*\* (.+?)\n", sheets, re.S)
    assert m, name
    return m.group(1).strip(), m.group(2).strip(), m.group(3).strip()

def lines_of(name):
    d = existing.get(name) or {}
    out = []
    for k, v in d.items():
        if isinstance(v, str):
            v = [v]
        out.append(f"  {k}: " + " / ".join(v))
    return "\n".join(out)

# (display name, sheet heading, existing-lines key, pronoun note, powers, kid, ride (name: description))
BOSSES = [
    ("Ginger", "Ginger", "Ginger", "he",
     "Freeze: every few turns he freezes one of your pieces; it can't move until it thaws (never your king). "
     "Ultimate, Blizzard: for three turns nearly everything of yours is frozen; at first only one piece, picked at random, can move, then the ice thaws.",
     "Crumb", "Candy Cane Sled: Gingerbread hull, candy-cane runners. Steering is optional; nibbling the gumdrops is not."),
    ("Boingo the Clown", "Boingo the Clown", "Boingo", "he",
     "Pie: he throws a cream pie onto a square; nobody, him included, can move there for a while. "
     "Ultimate, Funhouse: he turns the whole board around (upside down, then sideways) a step every few turns, until it's back the right way up.",
     "Squirt", "Boingo's Pogo: A clown's pogo stick with a frilly seat. Every square is a BOING."),
    ("Jefferson", "Jefferson", "Jefferson", "he",
     "Sparkler: a square on your half catches fire and burns down over a few turns; a piece of yours still on it at the end is lost (never your king). "
     "Ultimate, Roman Candle: waves of fireworks rain on the board, their shadows showing a few turns ahead where they'll land; some land on his own half, but his pieces are fireproof.",
     "Sparky", "Giraffe Gallop: A young giraffe with a hot head, a hotter mane and no idea what a speed limit is. Its horns are lit."),
    ("Hollow", "Hollow", "Hollow", "he",
     "Darkness: he tucks squares into the dark so you can't see what's there; touch the dark and guess wrong and it costs you. "
     "Ultimate, Lights Out: the whole board goes dark; when the lights come back, if you've lost track of too many of his pieces, he moves twice.",
     "Glim", "Hollow's Bulb: One bulb from Hollow's strand, gone rogue. Runs on darkness; somehow still lights up."),
    ("Big Boy", "Big Boy", "Big Boy", "he",
     "Snack: before the first move he eats one of your center pawns. Toy Blocks: he drops toy blocks on squares nobody can move onto (knights hop them). "
     "Ultimate, Big Bounce: he bounces and your pieces get knocked around the board.",
     "Blocky", "Big Boy's Buggy: Naptime on wheels. Big Boy swears he's too old for it, but it's his."),
    ("Sawyer", "Sawyer", "Sawyer", "he",
     "Split: after his first move he saws one of his pawns in two (two pawns from one). Saw Cuts: he cuts lines into your half that your pieces can't walk across (knights hop them). "
     "Ultimate, Board Saw: he saws the board in two for a while; nothing crosses the middle until it glues back together.",
     "Chip", "Sawyer's Dozer: Pushes dirt, pushes luck, never pushes the brake."),
    ("Wrangler", "Wrangler", "Wrangler", "he",
     "Lasso: every few turns he ropes one of your pieces and drags it a square (never a king or a bishop). "
     "Ultimate, Showdown: at high noon he lines up duels, his piece against one of yours of the same kind, and you pick which duel happens.",
     "Tex", "Rodeo Bull: Eight seconds is the record. He's never once let anyone off early."),
    ("Alfil", "Alfil", "Alfil", "he (a woolly mammoth; in old chess the bishop was an elephant, and he wants the square back)",
     "Tusks: two of his pawns glow, he waits, and they fuse into an elephant (a bishop); that's his whole move. "
     "Ultimate, Mammoth Slam: he stomps and three of your pieces fly up into the air for three turns, then come back down.",
     "Woolly", "Alfil's Howdah: A baby mammoth with a tiny throne on its back. It plods, you reign, nobody hurries."),
    ("Chub & Chirp", "Chub & Chirp", "Chub & Chirp", "two friends drawn as one: Chub, a brown rabbit, rides Chirp, a grasshopper. Chub talks; Chirp only chirps, written as (Chirp!)",
     "Leapfrog: his pawn hops right over one of yours that stands nose to nose with it. "
     "Ultimate, Carrot Patch (once a battle): five carrots are planted, you both race to pull them, then a spin decides what they're worth.",
     "Bun & Bug", "Riding Chirp: Chirp, Chub's trusty grasshopper, with a saddle. Goes one square per hop, and chirps about it the whole way."),
    ("Smudgy", "Smudgy", "Smudgy", "he",
     "Camouflage: his rook hides among his pawns, painted to look just like one, until it strikes. "
     "Repaint (twice a battle at most): he paints one of his pawns your color and one of your knights or bishops his.",
     "Dabble", "Brush Ride: Smudgy's spare brush. It flies fine; it just won't stop signing its work in the air."),
    ("Moo & Moon", "Moo & Moon", "Moo & Moon", "two friends: Moo, a cow who only ever says Moo (with a feeling), and the Moon, a crescent who does the talking. Moo's sounds go in brackets, like (Moo!). Only these two may use the little icons {heart} {question} {sparkle} {pawn} {anger} {zzz}, as in their lines",
     "Moonbeam: every few of his moves a moonbeam stuns one of your pieces; it can't move next turn. "
     "Ultimate, Full Moon: Moo glows and plays his very best for five moves, ends with a flurry of five beams, then he's dazed.",
     "Twinkle", "Moon's Ride: A sleepy crescent that gives rides on its way to bed. Mind the horns; it never minds anything."),
    ("Puddles", "Puddles", "Puddles", "he (a hippo gardener)",
     "Seeds: as the clock ticks he plants hidden seeds around the board. "
     "Ultimate, Watering: he waters the whole board (his whole turn) and the seeds come up; what grows can help him or hurt him.",
     "Drizzle", "Puddles's Mower: Top speed: a brisk stroll. Puddles insists that's plenty for the lawn and for the war."),
    ("Babur", "Babur", "Babur", "he (a retired circus tiger)",
     "Balloons: with his pump he blows up balloon pieces that land on the board as his; some of them pop. "
     "Ultimate, Hoops: burning hoops go up around some of your pieces; nothing gets in or out while they burn.",
     "Stripes", "Balloon Pup: A very good boy, twisted from one very long balloon. Do not bring a pin to the park."),
]

EXTRA = [
    ("Folio", "it (a paper crane folded from a page of someone's handwriting; never he or she)",
     "Folio is a paper crane folded from a page of someone's very serious handwritten notes. It's calm, polite and quietly sure of itself, "
     "an editor at heart: every game is a draft, every move can be revised, and it reads your plans like a page. It speaks in short, neat, "
     "complete sentences, never shouts, and is a little smug in the gentlest way. When it talks it makes a soft bird chirp.",
     "Draft: it marks one of your pieces, counts down, and folds that piece away for a while. "
     "Ultimate, Crease: it draws a pencil line across the board and folds along it; your pieces can't cross the crease for a few turns. "
     "Revision (once a battle): when you punish one of its mistakes, it crosses out both moves and plays a different one.",
     "Pleat", "Paper Crane: Folded from a page of someone's very serious notes. Flies fine, as long as nobody tries to read it.",
     lines_of("Folio")),
    ("Timber", "he (NEW boss, not in the game yet: no lines yet)",
     "Timber is a stout, friendly brown beaver standing upright: big buck teeth, an orange hard hat and safety vest, a yellow tool belt "
     "(hammer, tape measure, wrench), two planks on his back and a flat paddle tail. Proud and cheerful, a craftsman pleased with his work. "
     "He runs a workshop beside the board and builds new chess pieces out of scraps.",
     "Workshop (his passive): scraps come in as time passes and every time he captures; they go toward a pawn, knight, bishop, rook or queen in his workshop, "
     "and a finished piece is dropped onto an empty square on his side of the board. "
     "Ultimate, Gnaw: he gnaws one of your pawns down to scraps (if you have no pawns, nothing happens).",
     "his woodpecker foreman (a busy, bossy-but-friendly little woodpecker in a tiny hard hat; no name yet)",
     "The Log Roller: Timber's favorite commute. Keep your feet moving and never, ever look down.",
     "  (none yet) Write 4 lines each for: entrance, thinking, move, capture, check, hurt, smug, rattled, victory, defeat, strike, kingAttack,\n"
     "  scrap (scraps land in his workshop), built (a piece is finished), drop (he drops a new piece on the board),\n"
     "  ultimateWarn, ultimate (Gnaw), gnawNothing (you have no pawn to gnaw)."),
    ("Blitz", "he (NEW boss, not in the game yet: no lines yet)",
     "Blitz is a cheetah hustler from the park's speed-chess tables: lanky, spotted, black tear marks, a cocky grin, a backwards cap and a "
     "teal and orange zip jacket, with a chess clock tucked under one arm that he loves to slap. Fast-talking and restless, a showman, "
     "friendly-cocky, never mean. Everything is about speed and time with him.",
     "Clock Slap (his passive): when he captures a piece he slaps the clock and steals some of your time. "
     "Ultimate, Time Scramble: after a warning turn, your next five moves get only a few seconds each.",
     "his tortoise (a tiny, very slow tortoise; the joke is fast guy, slow buddy; no name yet)",
     "Cheetah Shoes: Spotted, laced and twice as fast. Blitz says the spots are just for show; the speed is not.",
     "  (none yet) Write 4 lines each for: entrance, thinking, move, capture, check, hurt, smug, rattled, victory, defeat, strike, kingAttack,\n"
     "  clockSlap (he slaps the clock after a capture), ultimateWarn, ultimate (Time Scramble starts), scrambleEnd (it's over)."),
]

KIDS = [
    ("Squirt", "Boingo", 700, "a tiny clown with a squirting flower"),
    ("Tex", "Wrangler", 800, "a little cowboy piglet"),
    ("Dabble", "Smudgy", 1000, "a little chameleon painter who blends in"),
    ("Blocky", "Big Boy", 1100, "a toddler with a big toy block"),
    ("Bun & Bug", "Chub & Chirp", 1300, "a baby bunny and a tiny bug who rides on him"),
    ("Pleat", "Folio", 1400, "a little folded paper bird ('it')"),
    ("Twinkle", "Moo & Moon", 1600, "a little star"),
    ("Drizzle", "Puddles", 1700, "a little hippo with a watering can"),
    ("Chip", "Sawyer", 1900, "a little raccoon helper who carries the small planks"),
    ("Stripes", "Babur", 2000, "a tiger cub with a purple balloon whose roar comes out squeaky"),
    ("Woolly", "Alfil", 2200, "a baby mammoth"),
    ("Crumb", "Ginger", 2300, "a little gingerbread kid, still a bit warm from the oven"),
    ("Sparky", "Jefferson", 2400, "a little giraffe with a sparkler"),
    ("Glim", "Hollow", 2500, "Hollow's eerie little shadow kid; the strongest bot in town, stronger than Hollow himself; only ever eerie, never cute"),
    ("(no name yet: 3 ideas wanted)", "Timber", "about 1500", "a busy, bossy-but-friendly woodpecker foreman in a tiny hard hat"),
    ("(no name yet: 3 ideas wanted)", "Blitz", "about 1200", "a tiny, very slow tortoise who carries his own little chess clock"),
]

OPENINGS = [
    ("sicilian", "Sicilian Defense"), ("french", "French Defense"), ("italian", "Italian Game"),
    ("spanish", "Spanish Game (call it only this; never its other name, which is a person's)"),
    ("queensgambit", "Queen's Gambit (accepted or declined)"), ("kingsindian", "King's Indian Defense"),
    ("english", "English Opening"), ("slav", "Slav Defense (and Semi-Slav)"), ("scotch", "Scotch Game"),
    ("dutch", "Dutch Defense"), ("catalan", "Catalan Opening"), ("vienna", "Vienna Game"),
    ("fourknights", "Four Knights Game"), ("kingsgambit", "King's Gambit"), ("scandinavian", "Scandinavian Defense"),
    ("london", "London System"), ("benoni", "Benoni Defense"),
]

POSITIONS = [
    ("youCastle", "you castle"), ("heCastles", "he castles"),
    ("youPromote", "your pawn reaches the end and becomes a queen"), ("hePromotes", "his pawn becomes a queen"),
    ("enPassant", "someone captures en passant"), ("queenTrade", "the queens are traded off"),
    ("heLosesQueen", "he loses his queen"), ("attackQueen", "you attack his queen"),
    ("youFork", "your piece attacks two of his at once"), ("heForks", "his piece attacks two of yours at once"),
    ("youPin", "you pin one of his pieces"), ("blunder", "you make a big mistake"),
    ("greatMove", "you find a really strong move"), ("longThink", "you've been thinking a long time"),
    ("endgame", "only a few pieces are left"), ("repetition", "the same position keeps repeating (a draw is close)"),
    ("godKing", "the God King (your champion) steps in against him"),
]

SPEAKERS = [b[0] for b in BOSSES] + [e[0] for e in EXTRA]
pairs = [(a, b) for i, a in enumerate(SPEAKERS) for b in SPEAKERS[i + 1:]]

out = []
w = out.append
w("HUNCHESS BOSS LINES: the prompt for Gemini (Nov 1, 2026)")
w("")
w("For Eric: copy everything below the COPY FROM HERE line into Gemini. It answers in parts; type \"next\" after each")
w("part until it says ALL DONE (about 14 parts). If a part stops partway, type \"continue\". Then send the parts back")
w("to Claude any way that's easy: a share link, \"Export to Docs\" (Claude can read your Google Drive), or pasted.")
w("Nothing here goes into the game until the director has checked every line against the rules below.")
w("")
w("===== COPY FROM HERE =====")
w("")
w("You're writing original dialogue for HunChess, a chess game for phones and computers. Players fight cartoon boss")
w("characters at chess. Sometimes one player fights a boss alone; sometimes a whole crowd of players votes on each move")
w("together, so \"you\" in a line should work for one player or a crowd. Each boss is a chess opponent with two special")
w("powers: a passive power that comes every few turns, and an ultimate that comes when its rage meter fills. The players")
w("have a champion, the God King, who stands by the board and can step in (he strikes the boss or plays a move).")
w("Players also walk around a town square where the bosses and their little kid sidekicks live. A chat box in the top")
w("corner shows what they say now and then, and players can play the kids at chess tables in the park. Players can")
w("also ride vehicles called rides around town; every boss has a ride made in its style.")
w("")
w("Lines show in a small speech bubble during battle, so they're short and punchy. The tone is a funny, friendly")
w("cartoon for all ages: teasing, never cruel.")
w("")
w("WHAT I NEED")
w("")
w("Part A, battle lines, for each boss (16 bosses, listed below):")
w("1. more.<moment>: 3 new lines for every moment in its \"Lines it says now\" list (6 for its power and ultimate")
w("   moments, including ultimateWarn). Use the moment names exactly as listed. For the two new bosses (Timber and")
w("   Blitz), write what their entry asks for instead.")
w("2. open.<name>: 2 lines for each named opening below, said when the game opens with it, in the boss's own")
w("   voice. Plus open.other: 3 lines for any other named opening, which never say its name.")
w("3. pos.<name>: 2 lines for each position moment below.")
w("4. take.<piece>: 2 lines for each piece he captures from you: take.pawn, take.knight, take.bishop, take.rook,")
w("   take.queen. Make them about him: a tiger retired from the circus might say of a knight, \"Another animal freed.\"")
w("   A hippo gardener might say, \"This one will look perfect in my garden.\"")
w("5. ride.own: 4 lines for when you show up riding his own ride (\"Nice ride!\", or \"Where did you get that?\", in his")
w("   voice). ride.other: 3 lines for when you ride another boss's ride. Use {ride} where the ride's name goes, for")
w("   example: \"{ride}? In MY battle? Bold.\"")
w("")
w("Part B, the town chat, for each boss:")
w("1. town: 10 everyday lines for the chat box: about the town, its home, the park, chess, the time of day, its kid.")
w("")
w("Part C, the bosses talking to each other in the town chat:")
w("1. One short exchange for every pair of the 16 bosses (120 pairs): 2 or 3 lines, back and forth. They're")
w("   neighbors and rivals, not enemies: teasing, bragging, a little history between them. Each pair should feel like")
w("   those two. Ginger loves cold and hates heat, so the fiery ones (Jefferson, and Babur with his burning hoops)")
w("   get his frostiest lines.")
w("")
w("Part D, the kids (the little guys), for each kid:")
w("1. town: 8 lines for the chat box.")
w("2. withBoss: 2 short exchanges with its own boss (2 or 3 lines each).")
w("3. table.hello, table.take, table.check, table.win, table.lose, table.draw: 2 lines each, for a game with them at")
w("   the park tables. Each kid's rating says how strong it is: 700 is a beginner, 2500 a master. Let that show.")
w("4. Then 16 kid-to-kid exchanges, kids you think would get along or squabble (2 or 3 lines each).")
w("5. For the woodpecker and the tortoise, 3 name ideas each (10 letters at most, original, not a real person).")
w("")
w("RULES FOR EVERY LINE")
w("- Battle lines: 70 characters at most, including spaces. Town and kid lines: 60 at most. One sentence or two")
w("  short ones. Use … for trailing off.")
w("- Original. No famous catchphrases, song lyrics, movie quotes, brands or trademarks.")
w("- Never name, quote or hint at a real person. That includes chess players and openings named after people,")
w("  which is why open.other never says the opening's name.")
w("- Never use the words Soviet, Russian or Grinch. Hollow never says Santa. Ginger never says \"snap\".")
w("- There's a secret boss in the game. Never mention any boss, character or place that isn't in this prompt.")
w("- American English spelling.")
w("- Stay in character. Each boss sounds like itself, never like a generic villain. Go easy on its pet words, tics")
w("  and sound effects: at most about one line in five, never two in a row.")
w("- Talk about powers the way a player sees them on the board, never with numbers or rules text.")
w("- Fair play: never hint at a good move for the player, and never give away anything hidden (which of Smudgy's")
w("  pawns is the rook, where Puddles' seeds are, what's in Hollow's dark).")
w("- Don't repeat a line the boss already says, or another line you've written. Vary the shape of the lines, not")
w("  just the words.")
w("- Pronouns as given in each entry.")
w("")
w("HOW TO REPLY (plain text only: no tables, no bullets, no bold, no numbering)")
w("Start each block with a header line, then one line per row: the key, a space, a | and a space, then the line.")
w("Example:")
w("@@ BOSS Alfil")
w("more.powerHit | Two became one. Worth every turn.")
w("open.sicilian | The Sicilian? I was there before it had a name.")
w("pos.youCastle | Hiding your king in the corner? Cozy.")
w("take.knight | Little horse. Big tusks.")
w("ride.own | My howdah! You do look regal up there.")
w("ride.other | {ride}? Mammoths walk, thank you.")
w("@@ TOWN Alfil")
w("town | The Pyramid's cool in the afternoon. Mind the dust.")
w("@@ PAIR Alfil + Babur")
w("Alfil | Big cat. Bigger ears on me.")
w("Babur | Please. I only want quiet and a balloon.")
w("@@ KID Woolly")
w("town | Woolly is big! Well, getting there.")
w("withBoss | Woolly: Grandpa, when do I get tusks?")
w("withBoss | Alfil: Patience. Mammoths never rush.")
w("withBoss | ---")
w("table.hello | Woolly will try to stomp! Gently.")
w("@@ KIDPAIR Woolly + Stripes")
w("Woolly | Can I hold the balloon?")
w("Stripes | Only if you promise not to sit on it.")
w("@@ NAMES Timber's woodpecker")
w("name | (an idea)")
w("")
w("(In withBoss, write each speaker's name before a colon, and put a --- row between the two exchanges.)")
w("")
w("ORDER: two bosses per reply, in the order listed (Part A, then that boss's Part B). Then the 120 pairs in four")
w("replies of 30. Then the kids in two replies. Then the kid pairs and the names. End the last reply with ALL DONE.")
w("")
w("THE NAMED OPENINGS (for open.<name>)")
for k, n in OPENINGS:
    w(f"- {k}: {n}")
w("- other: any other named opening (never say its name)")
w("")
w("THE POSITION MOMENTS (for pos.<name>)")
for k, n in POSITIONS:
    w(f"- {k}: {n}")
w("")
w("THE BOSSES")
for disp, head, key, pron, powers, kid, ride in BOSSES:
    one, para, voice = sheet(head)
    voice = voice.replace('Tics: "Snap!" and "Hmph.", used sparingly.', 'Tic: "Hmph.", used sparingly (never "snap").')
    w("")
    w(f"=== {disp} ===")
    w(f"Who: {one}")
    w(para)
    w(f"Voice: {voice}")
    w(f"Pronouns: {pron}")
    w(f"Powers: {powers}")
    w(f"Kid: {kid}")
    w(f"Ride: {ride}")
    w("Lines it says now (match this voice; don't repeat these):")
    w(lines_of(key))
for disp, pron, desc, powers, kid, ride, ls in EXTRA:
    w("")
    w(f"=== {disp} ===")
    w(desc)
    w(f"Pronouns: {pron}")
    w(f"Powers: {powers}")
    w(f"Kid: {kid}")
    w(f"Ride: {ride}")
    w("Lines it says now (match this voice; don't repeat these):" if "none yet" not in ls else "Lines:")
    w(ls)
w("")
w("THE KIDS (name, whose kid, chess rating, look)")
for n, boss, r, look in KIDS:
    w(f"- {n}: {boss}'s kid, rated {r}, {look}")
w("")
w("Some lines the kids say now: " + " / ".join([
    "Ooh, sparkly! Is it fireworks time yet? (Sparky)", "Psst! Smell my flower. Go on, closer! (Squirt)",
    "Crumb here! Careful, I'm still warm. (Crumb)", "Shh. The dark is thinking. (Glim)",
    "Blocky stacks it up. Then, crash! (Blocky)", "Chip made a pawn. It's a little crooked. (Chip)",
    "Stripes tried a roar. It came out squeaky. (Stripes)"]))
w("")
w("THE PAIRS (Part C), in this order:")
for i, (a, b) in enumerate(pairs, 1):
    w(f"{i}. {a} + {b}")
w("")
w("Start now with the first two bosses: Ginger and Boingo the Clown.")
text = "\n".join(out) + "\n"
open(HERE + "hunchess-boss-lines-for-gemini.txt", "w", encoding="utf-8").write(text)
print(len(text), "chars,", text.count("\n"), "lines,", len(pairs), "pairs")
