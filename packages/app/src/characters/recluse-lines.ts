/**
 * Every line of the Hidden Boss's fight, in one table to edit: his, by moment, and the God King's for this fight.
 *
 * Two kinds of line (DECISIONS.md, "The Hidden Boss, phase 1"; Eric, Oct 14: "keeping them intact is a must"):
 * - **Real quotes**, each marked `// QUOTE` with its source: word for word as first published (the research report's
 *   Tier A, verified), never shortened, adapted or re-punctuated.
 * - **PLACEHOLDERS** (every other line of his, and the God King's but his first): ours, written in his chess persona
 *   (intense, confident, against memorized theory and engine crutches, for "real chess"), waiting for Eric's own lines.
 *   None is presented as his words, none is a near-copy of a real quote; nothing political, nothing about any nation,
 *   nothing hateful.
 *
 * The phase change's chant and his chatter (`talk`; Eric, Oct 14 and 15) are about the 1962 Candidates in Curaçao, where he
 * said his rivals worked as a team against him (the quick draws they agreed among themselves, his games analyzed
 * together): mumbled fragments with his rivals' last names (ours), and his own words from his article on it, verified
 * against the printed page. Eric's rules for them: the last names are fine (Petrosian, Keres, Geller, Tal, Korchnoi),
 * never the words for their country or its people, and nothing that says Korchnoi threw games (only the agreed draws
 * and the teamwork, which historians largely accept).
 */
export const RECLUSE_LINES = {
  /** His entrance (the stare): one of these (placeholders). See `introE4` for a battle he opened with 1.e4 as White. */
  intro: ["Sit. Let's see if you can play.", "No opening book. Pure chess.", "Show me one move you didn't copy."],
  /** His entrance instead, when he's White and the battle's game opened 1.e4: the one place it reads right. */
  // QUOTE (A1): his note to 1 P-K4 in his game against Bisguier, Chess Life, Dec 1963, pp. 302-303; repeated in his 1969 book.
  introE4: "Best by test.",
  /** His ultimate as it comes, the clock turning to bullet: one, picked by the battle (placeholders: no verified quote fits). */
  bullet: ["Stop calculating. Just play!", "Stop staring. Pure chess. Move!", "All that thinking, no idea. Hurry!"],
  /**
   * A few moves into the bullet clock, he adds time per move (Eric, Oct 14): grudging, too fast even for real chess. One,
   * picked by the battle (placeholders: ours, not his words; the clock that adds time per move was his own invention, so
   * a line may hint at it, never as a quote). The number is on the board, not in the line (it's a setting).
   */
  bulletPlus: [
    "Too fast, even for real chess. Fine. A little time on every move.",
    "This is a lottery, not chess. Time per move, then. My own idea, you know.",
    "Bah. Nobody plays real chess this fast. I'll add time to every move.",
  ],
  /** The God King's help tried, and blocked (he slams the book shut): one, in turn. */
  mock: [
    // QUOTE (A6): Peter Kihss in the New York Times, Jul 4, 1972, p. 14 (Winter, C.N. 5830).
    "I don't believe in psychology. I believe in good moves.",
    // QUOTE (A3, a fragment as published): on 6 Be2 in the Grünfeld, his game against Greenwald, Chess Life, Oct 1963, pp. 237-238.
    "A genuine beginner's move",
    "Engine moves? Keep that crutch away from my board.",
    "Theory, engines, a king in armor. None of it is chess!",
  ],
  /** Consulting the book when he's behind on material, now and then (placeholders). */
  rattled: ["Hm. I've seen this before.", "Interesting. Very interesting."],
  /** He wins: one of these. */
  victory: [
    // QUOTE (A7): on Alekhine, "The Ten Greatest Masters in History", Chessworld, Jan-Feb 1964, pp. 56-61.
    "He knew book lines, not their meaning.",
    "Memorized moves. I knew it.",
  ],
  /** Beaten: his mumbling as he slumps on his knees, one line after another. */
  fall: [
    "The book said... no... no...",
    // QUOTE (A8): press conference, Sep 21, 1992, in Seirawan & Stefanovic, No Regrets.
    "Morphy was the greatest genius.",
    "Sixty-four squares. I counted.",
  ],
  // ---- Phase 2 (DECISIONS.md, "The Hidden Boss, phase 2"): four boards of Chess960. ----
  /**
   * The phase change's opening (Eric, Oct 17: "more talking after the mate", so a first-time player sees what comes):
   * still on his knees, his mumbling over and the God King gloating over him, he says he'll take the God King's power;
   * then he seizes it. One, picked per phase change (NEW, Oct 17: drafts for Eric, ours, not his words). Short enough to
   * be typed out before his hand goes up (a unit test checks).
   */
  seizeTalk: ["An engine in a golden crown... Give me that power!", "So he's your engine. I'll take his power myself."],
  /**
   * The phase change's start: he absorbs the God King (Eric, Oct 14: "brain and engine combined"), said as the power
   * lands in his fist; one, picked per phase change (placeholders: ours, not his words).
   */
  absorb: ["All game you leaned on an engine. Now see how you like it.", "Mind and machine. Both mine now."],
  /** He revives, as he snaps upright and the book flies back to his hand (placeholders). */
  revive: ["Not yet. Now we play real chess.", "On your feet, all of you. Again!"],
  /**
   * The phase change's chant over the open book (Eric's final lines, Nov 13; until then half-mad mumbling about Curaçao): both,
   * in turn, each its own box, each typed sentence by sentence with a pause between (RECLUSE_PHASE2.change.chantLines).
   */
  chantSay: [
    ["Computation without creativity is nothing.", "Now I have both."],
    ["Prepare yourself.", "This is the ultimate test of your skill."],
  ],
  /** Phase 2 begins, the four boards set up (placeholders). */
  phase2: ["No more memorized openings. Find your moves now!", "Four boards. No theory. Let's see who can play.", "Now nobody has a book. Except me."],
  /** He wins a board (mate, time or resign): one, in turn. */
  boardWon: ["One down. Who's next?", "Too slow. The clock doesn't wait."],
  /** He loses a board (placeholders). */
  boardLost: ["Hm. A lucky one.", "That board was nothing. Watch the others.", "So one of you can play."],
  /** A slow move (more than slowMoveSeconds, anyone's), before his ultimate: one, in turn (placeholders). */
  slow: ["Still thinking? Move!", "You think too hard. Play!", "The clock is ticking. So am I.", "Stop staring. Make a move!", "Faster! This isn't correspondence chess."],
  /**
   * His chatter (recluse-talk.ts; Eric, Oct 14 and 15): about every 15 s of play (RECLUSE_TALK), all through phase 1 and
   * phase 2, about the team against him (his games analyzed, collusion, Curaçao), in three stages as the fight goes on:
   * suspicious muttering, then accusations, then angry ranting. Each stage's lines in a shuffled order, none again until
   * all have been said. The lowest priority: said only when no other line is up, and any other line cuts in on it.
   * Phase 1 is you with the God King (an engine at your side) against him; phase 2, four boards against him (lines
   * about the boards are phase 2's only). Ours (PLACEHOLDERS), and his own words marked QUOTE, each in one phase only.
   */
  talk: {
    1: {
      // PLACEHOLDERS, new for phase 1 (Oct 15), but the one moved from phase 2.
      early: [
        "Who told you that move?",
        "That came quickly. Too quickly.",
        "Is someone whispering to you?",
        "You keep looking over at him. Why?",
        "I know an engine move when I see one.",
      ],
      middle: [
        // QUOTE: "The Russians Have Fixed World Chess", Sports Illustrated, Aug 20, 1962, p. 19 (scan of the printed page).
        "They consulted during the games.",
        "He's feeding you moves. Don't think I can't see it.",
        // QUOTE: the same article, p. 65 (scan of the printed page).
        "They would openly analyze my game while I was still playing it.",
        "You and your golden friend, picking my games apart together.",
        "Two against one. Curaçao all over again.",
        "A king in armor whispering moves. Is that chess?",
        "You two have been talking about my games. I know it.",
      ],
      late: [
        // QUOTE: the same article, p. 65 (scan of the printed page).
        "It made me mad that they thought they could get away with it.",
        "Petrosian did this. Keres did this. Now you!",
        "Teamwork! Always teamwork against me!",
        "Analyze it together, then! It won't save you!",
        "Geller, Keres, Petrosian... and now a king in armor!",
        "Enough whispering! Play your own moves!",
        "A whole team against me, as always!",
      ],
    },
    2: {
      early: ["I see you looking at each other's boards...", "Why is everyone so quiet over there?", "Four boards, and you all move together. Hm."],
      middle: [
        "You're analyzing my games together. I can see it.",
        "Petrosian, Keres, Geller... quick draws, every time. I remember.",
        // QUOTE: the same article, p. 19 (scan of the printed page; also word for word in Lawson, Standpoint, 2012).
        "They agreed ahead of time to draw the games they played against each other.",
      ],
      late: [
        // QUOTE: the same article, p. 19 (as in the chant).
        "They worked as a team.",
        "One team, one brain, all of you against me!",
        "Petrosian... Keres... Geller... and now all of you!",
        // QUOTE: the same article, p. 18 (scan of the printed page).
        "I will never again play in one of these tournaments.",
        "Draw, draw, draw... and every board against me!",
        // PLACEHOLDERS, new (Oct 15): a long phase 2 ran through the rest.
        "Whispering across the boards again! I hear you!",
        "Every board, the same plan! Who wrote it?",
      ],
    },
  },
  /**
   * Phase 2's chatter mocks the engine he took from the God King: every third line of his chatter, from the first, in
   * turn (`Chatter`; the lowest priority, as the rest of his chatter). Placeholders, ours.
   */
  engine: [
    "Fun, isn't it?",
    "Look how much fun we're having.",
    "Not so nice when the engine's on my side, is it?",
    "Go on, call your God King. Oh, that's right.",
    "Every line, every move. I see them all now.",
  ],
  /**
   * His phase 2 ultimate as it comes: a few seconds a move from now on (placeholders). Never the seconds: the banner
   * names it from the setting (RECLUSE_PHASE2.ultMoveSeconds) and the dock says what it means, as `bulletPlus`'s number
   * is the board's.
   */
  ult2: ["That's enough! No more thinking, all of you!", "Enough thinking! Move, or I move for you!"],
  /** Beaten on all four boards (placeholders; his "super saiyan" transformation comes later). */
  beaten2: ["Impossible... all four...", "Four boards... and not one book among them..."],
} as const;

/**
 * His child form (Eric, Nov 12-13: "new lines fitting a kid"; RECLUSE_CHILD): a skinny 1950s kid of about 9 who has just fallen
 * for the game, short and eager, in a boy's voice, a little older at each step up (`grow`). All PLACEHOLDERS (ours, waiting for
 * Eric's): none is a real quote, none names him or hints at his name, nothing about any nation.
 */
export const RECLUSE_CHILD_LINES = {
  /** His entrance (the fight's start): one. */
  intro: ["Wanna play? I set the pieces up myself.", "You want to play me? Okay. I'm ready.", "I've been practicing all week."],
  /** He takes a piece (now and then). */
  capture: ["Gotcha!", "That one's mine now.", "Ha! Didn't see that, huh?"],
  /** He loses one. */
  hurt: ["Hey! No fair.", "Aw, nuts.", "Okay. That was a good one."],
  /** He gives check. */
  check: ["Check! Your king's in trouble.", "Check! I saw that coming."],
  /** Behind on material. */
  rattled: ["Wait. Let me think.", "Hmm. I'll figure it out."],
  /** Ahead. */
  smug: ["This is the fun part.", "I love this game."],
  /** He wins. */
  victory: ["I won! Can we play again?", "Again! Let's go again!"],
  /** His level rising, a step of his ramp that isn't a step up in age (now and then). */
  levelUp: ["I'm getting it now.", "Oh! I see how it works.", "Every move is a little puzzle."],
  /** Each step up in age, by the age he reaches (13, 20, his adult look): one, picked by the battle. */
  grow: [
    ["I'm not a little kid anymore.", "I read every chess book in the library."],
    ["Every move should be beautiful.", "I don't play for draws."],
    ["No more games. Now I'm ready.", "Now you'll see real chess."],
  ],
  /** Beaten (then he grows up into the man the next match meets): one, picked by the battle. */
  beaten: ["Okay. You win this one.", "Just wait till I'm bigger.", "Fine. Now I'll play for real."],
} as const;

/**
 * The God King's lines in this fight (his usual ones about calling him are left out: his help doesn't work here). He has
 * none in phase 2: the boss absorbs him as it begins (Eric, Oct 14), so his last words are his cry as he's drained.
 */
export const KING_VS_RECLUSE = {
  /** His opening line (the first is Eric's own, ROADMAP.md, Oct 14; the others are placeholders). */
  intro: ["I sense a tremendous power within this foe.", "Careful. My strength feels faint against this one.", "This is no ordinary boss. Trust your own moves."],
  /** His help tried, and blocked (placeholders). */
  blocked: ["My power... it won't take hold!", "Nothing! He shrugs off my strength.", "I can't reach him. This fight is yours alone."],
  /** The phase change: he stands over the beaten boss, triumphant (short: his cry cuts in about two seconds later; placeholders). */
  triumph: ["Kneel. The crown always wins.", "Down you stay, bookworm!", "Your book is closed. Kneel!"],
  /** The phase change: his cry as the boss drains his power (placeholders). */
  drained: ["No! My light... what are you doing?!", "Release me! That power is mine!", "Aaagh! My strength!"],
} as const;

/**
 * The cutscene between his adult form and the cyborg (Eric's version, Nov 12, night; in the fight since Nov 13, solo and online): the
 * ghost of him as a child, and him on his knees. Each line is its own text box; a line of two sentences is typed one
 * sentence, a pause, then the next (each entry here is one sentence; one long sentence types all at once). The real quotes
 * stay unattributed and he is never named (RULES.md).
 */
export const RECLUSE_CUTSCENE_LINES: readonly { who: "kid" | "man"; say: readonly string[] }[] = [
  { who: "kid", say: ["Why are you on the floor?"] },
  { who: "man", say: ["I lost."] },
  { who: "kid", say: ["Do you still find them?"] },
  { who: "man", say: ["Find what?"] },
  { who: "kid", say: ["The moves that make you laugh out loud."] },
  { who: "man", say: ["The machines find them now.", "They don't need us anymore."] },
  { who: "kid", say: ["That's not the point."] },
  { who: "man", say: ["All that matters on the chessboard is good moves."] },
  { who: "kid", say: ["And how do you know they're good?", "Because a machine says so?"] },
  { who: "man", say: ["..."] },
  { who: "kid", say: ["Best by test, right?"] },
  { who: "man", say: ["I just wanted to play the most beautiful game anyone ever played."] },
  { who: "kid", say: ["Then why'd you stop?"] },
  { who: "man", say: ["The computers.", "They ruined everything."] },
  { who: "kid", say: ["Everyone has the same computers.", "So the best player is still the best."] },
  { who: "man", say: ["Do you really believe that?"] },
  { who: "kid", say: ["I'm not sure.", "The only one who can prove it is right next to me."] },
];
