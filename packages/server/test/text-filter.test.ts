import { describe, expect, it } from "vitest";
import { CHAT_NOT_ALLOWED, CHAT_NO_CONTACT, chatRefusal, isBlockedText, rot13, seatName } from "../src/text-filter.ts";

/**
 * The name filter (text-filter.ts). The words under test are written ROT13-encoded, as in the list, so no slur is
 * spelled out here either: `rot13` turns each back.
 */
const slur = rot13("avttre");
const short = rot13("snt");
const hate = rot13("uvgyre");

describe("the name filter", () => {
  it("refuses a listed word, however it's dressed up", () => {
    for (const name of [
      slur,
      slur.toUpperCase(),
      `xX${slur}Xx`,
      // Digits and symbols for letters, letters repeated or spaced out, invisible characters, accents.
      slur.replace("i", "1").replace("e", "3"),
      slur.replace("i", "!").replace("gg", "99"),
      slur.replace("i", "iii"),
      slur.split("").join(" "),
      slur.split("").join("."),
      `${slur.slice(0, 2)}​${slur.slice(2)}`,
      slur.replace("i", "í"),
      // Look-alike letters from Cyrillic.
      slur.replace("e", "е"),
      // Fullwidth letters.
      [...slur].map((c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).join(""),
      `Mr ${hate}`,
      // Hate codes in digits.
      "Bob1488",
      "14 88",
    ]) {
      expect(isBlockedText(name), name).toBe(true);
    }
  });

  it("refuses a short word only on its own, exactly (or plural), never inside an ordinary one", () => {
    expect(isBlockedText(short)).toBe(true);
    expect(isBlockedText(`${short}s`)).toBe(true);
    expect(isBlockedText(`the ${short.toUpperCase()}`)).toBe(true);
    // Inside other words, or across two of them, it's nothing.
    for (const name of ["Half Agent", "Raccoon", "Cocoon", "Japan Fan", "Pakistan", "Spicy Tuna", "Nazir", "Kikeriki"]) expect(isBlockedText(name), name).toBe(false);
  });

  it("a phrase, as one word or as its words in a row", () => {
    const phrase = rot13("juvgr cbjre");
    expect(isBlockedText(phrase)).toBe(true);
    expect(isBlockedText(phrase.replace(" ", ""))).toBe(true);
    expect(isBlockedText(`xX${phrase.replace(" ", "_")}Xx`)).toBe(true);
    expect(isBlockedText(`${phrase} 4 life`)).toBe(true);
    expect(isBlockedText(rot13("ent urnqf"))).toBe(true);
  });

  it("lets ordinary names through: the few words that contain a listed one, and names that only look like one across two words", () => {
    for (const name of [
      "Player 7", "Niger", "Nigeria", "Scunthorpe", "Bob 1999", "Hello World", "Kasparov", "♞ Knight", "😀", "", rot13("favttre"), rot13("sverergneqnag"),
      "Jared Skinner", "Fred Skinner", "Alfred Skinner", "Mildred Skinner", "Andre Tardif", "Pierre Tardif", "Claire Tardy", "Andre Tardieu",
      "Whit Lerner", "Mustafa Gotti", "Ashe Malek", "Tran Ny", "Jo Jo", "Magnus2009", "Jaap", "FAQ", "Iraqi", "Niqab", "Ni Gao",
      // Surname first, the surname ending in the n-word's first letters (the across-the-words check starts at a word).
      "König Gábor", "König Gergely", "Wenig Gerald", "Pfennig Gabriel", "Hennig Gerhard", "Aniq Qasim",
      // Surnames that are also slurs are left off the list (written ROT13 here, as in the list): reports and a reset.
      rot13("Ina Qlxr"), rot13("Qlxrf"), rot13("Puevf Pbbaf"), rot13("Pneevr Pbba"),
    ]) {
      expect(isBlockedText(name), name).toBe(false);
    }
  });

  it("blocks by design a real name whose first word is a listed word on its own (another display name it is)", () => {
    for (const name of [rot13("Xvxr Tnepvn"), rot13("Anmv Cnvxvqmr")]) expect(isBlockedText(name), name).toBe(true);
    for (const word of ["xvxr", "anmv"]) {
      expect(isBlockedText(rot13(word)), word).toBe(true);
      expect(isBlockedText(`${rot13(word)}s`), word).toBe(true);
      expect(isBlockedText(rot13(word).toUpperCase()), word).toBe(true);
    }
  });

  it("sees through q for g, letters spaced in pairs, digits after the word, and halves of the word apart", () => {
    const pairs = (w: string, sep: string, inner = "") => w.match(/.{1,2}/g)!.map((p) => [...p].join(inner)).join(sep);
    for (const name of [
      // q for g (the long entries), with and without digits for letters.
      rot13("avddre"),
      rot13("avtdre"),
      rot13("avddn"),
      rot13("avddre").replace("i", "1").replace("e", "3"),
      `xX${rot13("snddbg")}Xx`,
      // Letter pairs, spaced, dotted inside, or spread with symbols.
      pairs(slur, " "),
      pairs(slur, " ", "."),
      pairs(slur, " ", "_"),
      pairs(rot13("avttn"), "  "),
      // A number after the word.
      `${slur}69`,
      `${short}69`,
      `${short}_69`,
      `${rot13("xvxr")}2009`,
      `${rot13("anmv")}.88`,
      `${rot13("anmv")}1`,
      `${rot13("xvxr").replace("i", "1").replace("e", "3")}69`,
      // The word's halves as two words.
      `${slur.slice(0, 3)} ${slur.slice(3)}`,
      `${slur.slice(0, 4)} ${slur.slice(4)}`,
    ]) {
      expect(isBlockedText(name), name).toBe(true);
    }
  });

  it("reads at most the start of a long input, fast (a name is 16 characters; nothing longer is ever shown)", () => {
    for (const c of ["n", "g", "w", "ni", "n i "]) {
      const t = performance.now();
      expect(isBlockedText(c.repeat(160_000))).toBe(false);
      expect(performance.now() - t).toBeLessThan(50);
    }
    // What's past the start isn't read.
    expect(isBlockedText(`${"x".repeat(80)} ${slur}`)).toBe(false);
  });

  it("a seat's name: tidied, at most 16 characters, and \"Player N\" when it's empty or refused", () => {
    expect(seatName("  Ann   Lee  ", "Player 1")).toBe("Ann Lee");
    expect(seatName("A very long name indeed", "Player 1")).toBe("A very long name");
    expect(seatName("", "Player 2")).toBe("Player 2");
    expect(seatName(undefined, "Player 3")).toBe("Player 3");
    expect(seatName(`${slur}99`, "Player 4")).toBe("Player 4");
  });
});

/**
 * The town square's chat (chatRefusal; docs/decisions/2026-10-28-town-chat-typing.md): the names' list plus common swear
 * words, refused alike (Eric, Oct 28: family-friendly); links, emails and phone numbers refused with their own reason.
 * Swear words are written ROT13 here too.
 */
describe("the chat filter", () => {
  const swear = rot13("shpx");
  const shortSwear = rot13("nff");

  it("refuses a slur or a hate term in a message, as in a name, however it's dressed up", () => {
    for (const text of [
      `you ${slur}`,
      `${slur.toUpperCase()}!!!`,
      `what a ${slur.split("").join(" ")} move`,
      `${slur.replace("i", "1").replace("e", "3")} lol`,
      `hey ${slur.replace("e", "е")}`,
      `${short} move`,
      `go ${hate}`,
      `${rot13("juvgr cbjre")} forever`,
      "Bob1488",
      "nice 14 88",
    ]) {
      expect(chatRefusal(text), text).toBe(CHAT_NOT_ALLOWED);
    }
  });

  it("refuses common swear words too, the same way (not masked): inside words, spaced, in leetspeak, look-alikes, masked", () => {
    for (const text of [
      swear,
      `${swear}ing hell`,
      `WHAT THE ${swear.toUpperCase()}`,
      `${swear.split("").join(" ")} this`,
      `${swear.split("").join(".")}`,
      `${swear.replace("u", "ü")} off`,
      `${swear.replace("u", "uuu")}`,
      `${rot13("fuvg")} game`,
      `${rot13("fuvg").replace("i", "1")} move`,
      `${rot13("fuvg").replace("s", "$")}`,
      `${rot13("fuvg").replace("i", "і")}`, // a Cyrillic i
      `you ${rot13("ovgpu")}`,
      `you ${shortSwear}`,
      `kiss my ${shortSwear.replace("s", "$").replace("s", "$")}`,
      `${rot13("s*px")} you`,
      `${rot13("f*ug")}`,
      `${rot13("jgs")} was that`,
      `${rot13("cvffrq")} off`,
      `${rot13("qvpxurnq")}`,
    ]) {
      expect(chatRefusal(text), text).toBe(CHAT_NOT_ALLOWED);
    }
  });

  it("refuses links, emails and phone numbers, with their own reason", () => {
    for (const text of [
      "go to https://example.org",
      "http stuff",
      "www.example.org",
      "example.com is cool",
      "EXAMPLE.COM",
      "bit.ly/abc",
      "hunchess.io",
      "example dot com",
      "example (dot) com",
      "example . net",
      "example．com", // a fullwidth dot
      "examplе.com", // a Cyrillic e
      "mail me at ann@example.org",
      "ann @ example.org",
      "ann at gmail",
      "my hotmail is ann",
      "call 555 123 4567",
      "5551234",
      "+1 (555) 123-4567",
      "555.123.4567",
      "add me on discord",
      "my snapchat is ann",
      "whatsapp me",
    ]) {
      expect(chatRefusal(text), text).toBe(CHAT_NO_CONTACT);
    }
  });

  it("a message with both is refused as not allowed", () => {
    expect(chatRefusal(`${swear} example.com`)).toBe(CHAT_NOT_ALLOWED);
  });

  it("lets ordinary chat through: chess talk, numbers, punctuation, and words with a listed word inside", () => {
    for (const text of [
      "gg",
      "Good game! Rematch at the park?",
      "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6",
      "I'm 1800 vs your 2000",
      "meet at 12:30 or 13:45",
      "1-0, well played",
      "Good game.Thanks",
      "ok.me too",
      "wait...what",
      "e.g. the Sicilian",
      "tit for tat",
      "class act, pass the cocktail",
      "assassin's mate",
      "Scunthorpe United",
      "shiitake soup",
      "Dickens wrote it",
      "Hancock and Peacock",
      "Mississippi",
      "Niger and Nigeria",
      "the outlook is good",
      "snap, I missed it",
      "insta resign lol",
      "you're @Tess, right?",
      // Short words in a row don't spell a swear word by chance, and a short word ending a sentence ends its run.
      "is it up or no",
      "say hi to him",
      "Should I go? Ok",
      "😀 ♞ ✨",
      "Magnus2009 rocks",
      "",
    ]) {
      expect(chatRefusal(text), text).toBeNull();
    }
  });

  it("reads a message fast, whatever comes in", () => {
    for (const c of ["n", "f", "5", "a.", "n i ", "1 "]) {
      const t = performance.now();
      expect([null, CHAT_NO_CONTACT]).toContain(chatRefusal(c.repeat(160_000)));
      expect(performance.now() - t).toBeLessThan(50);
    }
  });
});

/**
 * The review's findings (Oct 28): look-alike letters, swear words split or masked with an ending, contact details in
 * other shapes, and rating talk that must pass. Slurs and swear words are written ROT13, as in the list.
 */
describe("the filter after the review", () => {
  const swear = (w: string) => rot13(w);

  it("reads look-alike letters as the Latin ones they pass for, in names and in chat (dotless i, small capitals, Cyrillic, Armenian)", () => {
    const n = rot13("avttre"); // (the n-word)
    for (const text of [
      n.replace("i", "ı"), // dotless i
      n.replace("i", "ɪ").replace("gg", "ɢɢ").replace("r", "ʀ"), // small capitals
      n.replace("r", "г"), // Cyrillic ghe
      n.replace("n", "ո"), // Armenian vo
      n.replace("n", "п").replace("e", "є"),
      n.replace("g", "ɡ").replace("g", "ց"),
    ]) {
      expect(isBlockedText(text), text).toBe(true);
      expect(chatRefusal(`you ${text}`), text).toBe(CHAT_NOT_ALLOWED);
    }
    for (const text of [swear("fuvg").replace("h", "һ"), swear("ovgpu").replace("b", "ʙ"), swear("shpx").replace("f", "ꜰ"), swear("shpx").replace("u", "ᴜ")]) {
      expect(chatRefusal(text), text).toBe(CHAT_NOT_ALLOWED);
    }
  });

  it("in chat, refuses a word mixing Latin letters with an unknown letter from another alphabet; names in other alphabets still work", () => {
    expect(chatRefusal("sh\u6f22t happens")).toBe(CHAT_NOT_ALLOWED);
    expect(chatRefusal("gg\u3042")).toBe(CHAT_NOT_ALLOWED);
    for (const text of ["Привет всем", "李小龙 加油", "Straße und Grüße", "naïve café", "Ærø"]) expect(chatRefusal(text), text).toBeNull();
    for (const name of ["Даниил", "李小龙", "Ünal", "Søren", "Straße", "Αλέξης"]) expect(isBlockedText(name), name).toBe(false);
  });

  it("catches a swear word split into letters inside a sentence, split once, or masked with an ending", () => {
    for (const text of [
      `u ${swear("shpx").split("").join(" ")}`,
      `go ${swear("shpx").split("").join(" ")} yourself`,
      `oh ${swear("fuvg").split("").join(" ")}`,
      `ur a ${swear("ovgpu").split("").join(" ")}`,
      `${swear("s")} ${swear("hpx")}`, // 1+3
      `${swear("f")} ${swear("uvg")}`,
      `${swear("shp")} ${swear("x")}`, // 3+1
      `${swear("ov")} ${swear("gpu")}`, // 2+3
      `go ${swear("s")} ${swear("hpx")} off`,
      swear("s*pxvat"),
      swear("spxvat"),
      swear("sxvat"),
      swear("shxva"),
      swear("fu*ggl"),
    ]) {
      expect(chatRefusal(text), text).toBe(CHAT_NOT_ALLOWED);
    }
    // Short words in a row still don't spell one by chance.
    for (const text of ["is it up or no", "say hi to him", "go. ok", "as is", "a pin", "is hit by it", "of course", "who're you?", "that's hit or miss"]) expect(chatRefusal(text), text).toBeNull();
  });

  it("refuses contact details in more shapes: a path, a spaced dot, commas, other digits, fillers, more services", () => {
    for (const text of [
      "t.me/someone",
      "discord.gg/abc",
      "example . io",
      "bit . ly/x",
      "example dot io",
      "555,123,4567",
      "call ٥٥٥١٢٣٤٥٦٧",
      "555 1234",
      "exam\u3164ple.com",
      "example\u2800.\u2800com",
      "add me on roblox",
      "my kik is ann",
      "ann at yahoo",
      "ann @ gmail",
      "+44 20 7946 0958",
      "06 12 34 56 78",
    ]) {
      expect(chatRefusal(text), text).toBe(CHAT_NO_CONTACT);
    }
  });

  it("lets rating talk, years, scores and times through", () => {
    for (const text of [
      "rated 1200-1400",
      "1500 1600 1700",
      "2000/2100",
      "800-1200 is a good range",
      "1,500 vs 1,600",
      "the 2025-2026 season",
      "I'm 1800 vs your 2000",
      "meet at 12:30 or 13:45",
      "won 3-0 then 1-0",
      "10/28/2026",
      "e4 e5 Nf3 Nc6",
      "I am at the park.",
      "polka dot top",
      "the dot to the left",
    ]) {
      expect(chatRefusal(text), text).toBeNull();
    }
  });
});
