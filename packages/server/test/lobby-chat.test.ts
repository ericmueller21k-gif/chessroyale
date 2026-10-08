import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, FRONT_DOOR, LOBBY_LIFE, QUICK_CHAT, RAID_SETTINGS, modeSettings, mulberry32, type Settings } from "@chessroyale/core";
import { sanLineToUci, type NetChatLine, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, lobbyClosing, newLobbyRecord } from "../src/lobby.ts";

/**
 * Quick chat in the lobby before the match (DECISIONS.md, "Lobby chat"): the queue, a private lobby, the full grid's
 * moment before the votes. One channel for everyone there, the same checks as in the match, a hello from the bots
 * as they sit down, and never a reason for the lobby to stay open.
 */

const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({
  id: `o${i}`,
  eco: "C95",
  name: `Opening ${i}`,
  family: `Family ${i}`,
  unusual: false,
  moves: line,
  namedPlies: 12,
  expected: Object.fromEntries(Array.from({ length: 13 }, (_, n) => [n, 0.5])),
}));

type Msg = ServerMessage;
const MIN = 60_000;
const CROWD = modeSettings("crowd", { crowdTeams: true, augments: false });

/** A lobby on a fake clock, an outbox per player; `join` seats someone the way the Durable Object does (then resendTo). */
function setup(settings: Partial<Settings> = CROWD, icons: Record<string, string> = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const core = new LobbyCore(
    newLobbyRecord("QCHAT", now),
    { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]), icon: (id) => icons[id] },
    library,
    mulberry32(11),
    { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...settings },
  );
  const join = (name: string, uid?: string) => {
    const r = core.connect(undefined, name, "phone", false, null, {}, uid);
    if (!r.ok) throw new Error(r.message);
    core.resendTo(r.playerId);
    return r.playerId;
  };
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const heard = (id: string): NetChatLine[] => (inbox.get(id) ?? []).flatMap((m) => (m.t === "chat" ? [m.line] : []));
  const people = (id: string) => heard(id).filter((l) => /^p\d/.test(l.from));
  const clear = () => inbox.clear();
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  const say = (id: string, s: unknown, to?: "team" | "all") => core.message(id, { t: "chat", say: s, ...(to ? { to } : {}) } as never);
  return { core, join, last, heard, people, clear, advance, say, inbox, get now() { return now; } };
}

/** A queue (Play now, Default: bots at the fill time) with Ann, Bo and Cy waiting in it. */
function queue(icons: Record<string, string> = {}) {
  const L = setup(CROWD, icons);
  L.core.setAuto(L.now + 60_000);
  const [ann, bo, cy] = [L.join("Ann", "u-ann"), L.join("Bo", "u-bo"), L.join("Cy", "u-cy")];
  return { L, ann: ann!, bo: bo!, cy: cy! };
}

describe("lobby: quick chat before the match", () => {
  it("the lobby is one channel: every line you own goes to everyone there (plans too), marked as the lobby's", () => {
    const { L, ann, bo, cy } = queue();
    // Each got the (empty) log and their packs when they joined: chat is open in the queue.
    expect(L.last(cy, "chatLog")).toMatchObject({ lines: [], packs: ["basics", "emoji-basics"] });
    expect(L.core.chatOpen()).toBe(true);
    L.clear();
    // A plan (team-only in a match): there are no teams yet, so it goes to everyone, whatever the switch said.
    L.say(ann, "push-pawns", "team");
    for (const id of [ann, bo, cy]) expect(L.people(id)).toEqual([expect.objectContaining({ from: ann, say: "push-pawns", to: "all", team: null, lobby: true })]);
    L.advance(3_000);
    L.say(bo, "go-mate", "all");
    expect(L.last(bo, "chatNo")).toBeUndefined();
    expect(L.people(cy).map((l) => [l.from, l.say])).toEqual([
      [ann, "push-pawns"],
      [bo, "go-mate"],
    ]);
    // Someone joining now gets what was said, with the names from the lobby (never from the message).
    const di = L.join("Di", "u-di");
    expect(L.last(di, "chatLog")!.lines.map((l) => [l.from, l.say, l.lobby])).toEqual([
      [ann, "push-pawns", true],
      [bo, "go-mate", true],
    ]);
    expect(L.last(di, "lobby")!.players.map((p) => p.name)).toEqual(["Ann", "Bo", "Cy", "Di"]);
  });

  it("works in a private lobby and a raid's; Classic has none", () => {
    for (const settings of [CROWD, { ...RAID_SETTINGS, bossIntroSeconds: 0 } as Partial<Settings>]) {
      const L = setup(settings);
      const [ann, bo] = [L.join("Ann"), L.join("Bo")];
      L.say(bo, "e-fire");
      expect(L.people(ann)).toEqual([expect.objectContaining({ from: bo, say: "e-fire", lobby: true })]);
    }
    const C = setup({});
    const ann = C.join("Ann");
    expect(C.last(ann, "chatLog")).toBeUndefined();
    C.say(ann, "gg");
    expect(C.last(ann, "chatNo")).toMatchObject({ reason: "closed" });
  });

  it("drops free text, unknown ids and pack lines you don't own, as in the match", () => {
    const { L, ann, bo } = queue();
    L.clear();
    for (const s of ["hey all, add me", "", 42, null, { id: "gg" }, "gg ", "GG"]) {
      L.say(ann, s);
      expect(L.last(ann, "chatNo")!.reason).toBe("unknown");
    }
    L.say(ann, "gk-crown");
    expect(L.last(ann, "chatNo")).toMatchObject({ say: "gk-crown", reason: "locked" });
    L.say(ann, "e-dragon");
    expect(L.last(ann, "chatNo")).toMatchObject({ say: "e-dragon", reason: "locked" });
    expect(L.people(bo)).toEqual([]);
    // Once the account owns the pack (read when they join), it goes.
    L.core.chatOwned(ann, ["chat-godking"]);
    L.say(ann, "gk-crown");
    expect(L.people(bo).map((l) => l.say)).toEqual(["gk-crown"]);
    // Not a person in this lobby: nothing.
    L.say("p99", "gg");
    L.say("bot3", "gg");
    expect(L.people(bo).map((l) => l.say)).toEqual(["gk-crown"]);
  });

  it("mute and chat off: a muted player's lines don't reach you; off, nothing does and you can't send; back on brings the missed lines", () => {
    const { L, ann, bo, cy } = queue();
    L.clear();
    L.core.message(bo, { t: "chatPrefs", muted: [ann, "nobody"] });
    expect(L.core.record.chat!.muted[bo]).toEqual([ann]);
    L.say(ann, "hi-all");
    expect(L.people(bo)).toEqual([]);
    expect(L.people(cy).map((l) => l.say)).toEqual(["hi-all"]);
    L.core.message(cy, { t: "chatPrefs", off: true });
    L.advance(3_000);
    L.say(ann, "lets-go");
    expect(L.people(cy).map((l) => l.say)).toEqual(["hi-all"]);
    L.say(cy, "wow");
    expect(L.last(cy, "chatNo")).toMatchObject({ reason: "off" });
    expect(L.people(ann).map((l) => l.say)).toEqual(["hi-all", "lets-go"]);
    L.core.message(cy, { t: "chatPrefs", off: false });
    expect(L.last(cy, "chatLog")!.lines.map((l) => l.say)).toEqual(["hi-all", "lets-go"]);
    // The mute lasts into the match.
    L.advance(60_000);
    L.advance(FRONT_DOOR.fillShowMs);
    expect(L.core.record.phase).not.toBe("lobby");
    L.clear();
    L.advance(3_000);
    L.say(ann, "gg", "all");
    expect(L.people(bo)).toEqual([]);
    expect(L.people(cy).map((l) => l.say)).toEqual(["gg"]);
  });

  it("the limits: one every 3 s, 5 in 30 s, no repeats; leaving the queue and taking a new seat doesn't reset them", () => {
    const { L, ann, bo } = queue();
    L.clear();
    const t0 = L.now;
    L.say(ann, "hi-all");
    L.say(ann, "wow");
    expect(L.last(ann, "chatNo")).toMatchObject({ reason: "gap", retryAt: t0 + QUICK_CHAT.minGapMs });
    L.advance(3_000);
    L.say(ann, "hi-all");
    expect(L.last(ann, "chatNo")).toMatchObject({ reason: "repeat" });
    for (const s of ["wow", "oops", "lets-go", "have-fun"]) {
      L.say(ann, s);
      L.advance(3_000);
    }
    L.say(ann, "thanks");
    expect(L.last(ann, "chatNo")).toMatchObject({ reason: "burst", retryAt: t0 + QUICK_CHAT.burstWindowMs });
    expect(L.people(bo).map((l) => l.say)).toEqual(["hi-all", "wow", "oops", "lets-go", "have-fun"]);
    // Cancel, PLAY again into the same lobby: a new seat, the same account, the same limits.
    L.core.message(ann, { t: "leave" });
    const again = L.join("Ann", "u-ann");
    expect(again).not.toBe(ann);
    L.say(again, "thanks");
    expect(L.last(again, "chatNo")).toMatchObject({ reason: "burst", retryAt: t0 + QUICK_CHAT.burstWindowMs });
    L.advance(t0 + QUICK_CHAT.burstWindowMs - L.now);
    L.say(again, "thanks");
    expect(L.people(bo).at(-1)).toMatchObject({ from: again, say: "thanks" });
  });

  it("someone who leaves takes their seat: newcomers never get their lines, and their chat choices go", () => {
    const { L, ann, bo } = queue();
    L.say(ann, "hi-all");
    L.core.message(ann, { t: "chatPrefs", muted: [bo], off: true });
    L.core.message(ann, { t: "leave" });
    const c = L.core.record.chat!;
    expect(c.muted[ann]).toBeUndefined();
    expect(c.off[ann]).toBeUndefined();
    // (Bo saw it and keeps it: the app keeps the names it has seen.)
    expect(L.people(bo).map((l) => l.say)).toEqual(["hi-all"]);
    const di = L.join("Di", "u-di");
    expect(L.last(di, "chatLog")!.lines).toEqual([]);
  });

  it("bots say hello in the lobby as they fill the empty seats: one or two, to everyone, while the full grid shows", () => {
    for (let people = 1; people <= 8; people++) {
      const L = setup(CROWD);
      L.core.setAuto(L.now + 60_000);
      const ids = Array.from({ length: people }, (_, i) => L.join(`P${i}`));
      expect(L.heard(ids[0]!)).toEqual([]);
      L.advance(60_000);
      const filled = L.now;
      expect(L.core.record.auto?.filledAt).toBe(filled);
      const bots = new Set(L.core.record.bots.map((b) => b.id));
      const hello = L.heard(ids[0]!).filter((l) => bots.has(l.from));
      expect(hello.length).toBeGreaterThanOrEqual(1);
      expect(hello.length).toBeLessThanOrEqual(QUICK_CHAT.botLobbyMax);
      for (const l of hello) {
        expect(l).toMatchObject({ to: "all", team: null, lobby: true });
        expect(["hi-all", "have-fun", "lets-go"]).toContain(l.say);
        // Shown a moment later, before the votes begin.
        expect(l.at).toBeGreaterThan(filled);
        expect(l.at).toBeLessThan(filled + FRONT_DOOR.fillShowMs);
      }
      // Everyone in the lobby hears them.
      for (const id of ids) expect(L.heard(id).filter((l) => bots.has(l.from)).map((l) => l.n)).toEqual(hello.map((l) => l.n));
      // The match's own hello follows; all of the bots' lines together stay within the per-minute cap.
      L.advance(FRONT_DOOR.fillShowMs);
      expect(L.core.record.phase).not.toBe("lobby");
      const all = L.core.record.chat!.lines.filter((l) => bots.has(l.from));
      for (const l of all) expect(all.filter((m) => Math.abs(m.at - l.at) < 60_000).length).toBeLessThanOrEqual(QUICK_CHAT.botMaxPerMinute);
    }
  });

  it("no hellos without bots (Bots off), nor before they've sat down; a private lobby's bots greet as its match begins, as before", () => {
    const off = setup(CROWD);
    off.core.setAuto(null, true);
    const a = off.join("Ann");
    off.advance(5 * MIN);
    expect(off.heard(a)).toEqual([]);
    const P = setup(CROWD);
    const ann = P.join("Ann");
    P.advance(5 * MIN);
    expect(P.heard(ann)).toEqual([]);
    P.core.message(ann, { t: "start" });
    // (Straight to the match: its lines are the match's, not the lobby's.)
    expect(P.heard(ann).every((l) => !l.lobby)).toBe(true);
  });

  it("chat never keeps a lobby open: the hour without anything happening runs from the last join, leave or connection", () => {
    expect(LOBBY_LIFE.lobbyIdleMinutes).toBe(60);
    // A private lobby nobody starts, with two people chatting the whole time.
    const L = setup(CROWD);
    const made = L.now;
    const [ann, bo] = [L.join("Ann"), L.join("Bo")];
    const closes = lobbyClosing(L.core.record, true)!;
    expect(closes).toEqual({ at: made + 60 * MIN, reason: "idle" });
    const says = ["hi-all", "lets-go", "have-fun", "good-luck", "e-fire"];
    for (let t = 0, i = 0; L.now < made + 59 * MIN; t++) {
      L.advance(7_000);
      L.say(t % 2 ? ann : bo, says[i++ % says.length]);
      if (t % 10 === 0) L.core.message(ann, { t: "chatPrefs", off: false, muted: [] });
      expect(lobbyClosing(L.core.record, true)).toEqual(closes);
    }
    expect(L.people(ann).length).toBeGreaterThan(400);
    // Nothing chat does sets a timer: the Durable Object's alarm stays the lobby's closing time.
    expect(L.core.nextAlarm).toBeNull();
    // (Anything else still counts, as before.)
    L.core.message(ann, { t: "speed", nps: 500_000 });
    expect(lobbyClosing(L.core.record, true)!.at).toBe(L.now + 60 * MIN);
  });

  it("chat doesn't hold up a queue: the bots fill at the fill time and the match begins on time", () => {
    const { L, ann, bo } = queue();
    const fillAt = L.core.record.auto!.fillAt!;
    for (let i = 0; i < 19; i++) {
      L.advance(3_000);
      L.say(i % 2 ? ann : bo, i % 3 ? "hi-all" : "e-party");
      expect(L.core.nextAlarm).toBe(fillAt);
    }
    L.advance(fillAt - L.now);
    expect(L.core.record.auto!.filledAt).toBe(fillAt);
    L.advance(FRONT_DOOR.fillShowMs);
    expect(L.core.record.phase).toMatch(/^(vote|opening)$/);
  });

  it("the lobby's lines carry on into the match's feed: everyone's log keeps them (icons not sent again), and a rejoin gets them", () => {
    const { L, ann, bo, cy } = queue({ p1: "♞", p2: "🦊", p3: "🐉" });
    L.clear();
    L.say(ann, "hi-all");
    expect(L.people(bo)[0]!.icon).toBe("♞");
    L.advance(60_000);
    L.advance(FRONT_DOOR.fillShowMs);
    expect(L.core.record.phase).toMatch(/^(vote|opening)$/);
    // As the match begins: the log (with teams now) still has the lobby's line, without the icon Bo already has.
    const log = L.last(bo, "chatLog")!;
    const kept = log.lines.find((l) => l.from === ann)!;
    expect(kept).toMatchObject({ say: "hi-all", lobby: true, team: null, to: "all" });
    expect(kept.icon).toBeUndefined();
    // Lines said now are the match's (a team, no lobby mark).
    L.advance(3_000);
    L.say(cy, "push-pawns");
    const now = L.core.record.chat!.lines.at(-1)!;
    expect(now.lobby).toBeUndefined();
    expect(now.team).not.toBeNull();
    // A rejoin gets the lobby's line again, icon and all.
    L.core.disconnect(bo);
    L.core.resendTo(bo);
    expect(L.last(bo, "chatLog")!.lines.find((l) => l.from === ann)).toMatchObject({ lobby: true, icon: "♞" });
  });
});
