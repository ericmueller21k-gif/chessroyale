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
