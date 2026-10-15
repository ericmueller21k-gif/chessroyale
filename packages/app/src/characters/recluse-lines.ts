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
  intro: ["Sit down. Let's find out if you can really play.", "Forget your opening book. Here we play chess.", "Show me one move you didn't copy from somewhere."],
  /** His entrance instead, when he's White and the battle's game opened 1.e4: the one place it reads right. */
  // QUOTE (A1): his note to 1 P-K4 in his game against Bisguier, Chess Life, Dec 1963, pp. 302-303; repeated in his 1969 book.
  introE4: "Best by test.",
  /** His ultimate as it comes, the clock turning to bullet: one, picked by the battle (placeholders: no verified quote fits). */
  bullet: ["You're thinking too much. Stop calculating and play!", "Enough staring at the board. Pure chess now. Move!", "All that thinking, and still no idea. Play fast!"],
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
    "He played book lines, but didn't know them very well.",
    "Memorized moves. I knew it.",
  ],
  /** Beaten: his mumbling as he slumps on his knees, one line after another. */
  fall: [
    "No... the book said... bishop takes... no...",
    // QUOTE (A8): press conference, Sep 21, 1992, in Seirawan & Stefanovic, No Regrets.
    "Morphy, I think everyone agrees, was probably the greatest genius of them all.",
    "Sixty-four squares... I counted every one...",
  ],
  // ---- Phase 2 (DECISIONS.md, "The Hidden Boss, phase 2"): four boards of Chess960. ----
  /**
   * The phase change's start: he absorbs the God King (Eric, Oct 14: "brain and engine combined"), said as the power
   * lands in his fist; one, picked per phase change (placeholders: ours, not his words).
   */
  absorb: ["All game you leaned on an engine. Now see how you like it.", "Mind and machine. Both mine now."],
  /** He revives, as he snaps upright and the book flies back to his hand (placeholders). */
  revive: ["Not yet. Now we play real chess.", "On your feet, all of you. Again!"],
  /**
   * The phase change's chant over the book (one, picked per phase change; one bubble): half-mad mumbling about Curaçao.
   * Ours (placeholders), but for one quote.
   */
  chant: [
    "Petrosian... Keres... Geller...",
    // QUOTE: his article "The Russians Have Fixed World Chess", Sports Illustrated, Aug 20, 1962, p. 19 (read on a scan
    // of the printed page; the same passage word for word in Dominic Lawson, "Collusion in Curaçao", Standpoint, 2012).
    "They worked as a team.",
    "Keres... Geller... draw... draw...",
    "Petrosian... half a point... draw...",
    "Tal... Korchnoi... Keres... Geller...",
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
  /** His phase 2 ultimate as it comes: a few seconds a move from now on (placeholders). */
  ult2: ["That's enough! Five seconds a move, all of you!", "Enough thinking! Five seconds, or I move for you!"],
  /** Beaten on all four boards (placeholders; his "super saiyan" transformation comes later). */
  beaten2: ["Impossible... all four...", "Four boards... and not one book among them..."],
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
