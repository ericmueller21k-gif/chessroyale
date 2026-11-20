import { describe, expect, it, vi } from "vitest";
import { BATTLE_TOWER, DEFAULT_SETTINGS, TOWER_PARTY, finishFloor, floorSettings, mulberry32, newRun, towerPartySettings, towerPool, type Settings } from "@chessroyale/core";
import { SQUADS_PROTOCOL, type PartyServerMessage } from "@chessroyale/chess/squads";
import { createGuest, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { commitPartyFloor, finishTowerFloor, membersOf, partyFloorWrite, partyPlan, preparePartyFloor, startTowerFloor, stopTower, towerMoves, towerState, type Fight, type PartyFloorPrep } from "../src/tower.ts";
import { PartyCore, TOWER_PARTY_LINES, newPartyRecord } from "../src/squads-party.ts";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";
import { partyLobby } from "../src/boss-party.ts";
import { library } from "./lobby-fixture.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));

/**
 * The Battle Tower's party (Nov 20; docs/decisions/2026-11-20-tower-party.md): one run, a copy each; every floor's result written to
 * every member's copy by the match room; the run's own members (two or more, nobody new) climb it together again from the lowest of
 * their floors; a new party starts its own run (asking first whoever's own party climb it ends); a member plays their copy on alone
 * (solo from then on); the sign-in merge and deleting an account; the party's plan and START; the room's ends for each copy.
 */
const T0 = 1_800_000_000_000;
const POOL = towerPool();

async function world() {
  const { sql } = memoryDb();
  await ensureSchema(sql);
  return sql;
}
const signedIn = async (sql: Sql, email: string) => signInWithIdentity(sql, (await createGuest(sql, T0, "Player")).user, "email", email, {}, T0);
const copyOf = (sql: Sql, uid: string) =>
  sql.first<{ id: string; floor: number; status: string; fight: string | null; members: string | null; seed: number; met: string; last: string | null }>(
    "SELECT id, floor, status, fight, members, seed, met, last FROM tower_runs WHERE user_id = ? AND kind = 'party' AND status = 'open'",
    uid,
  );
const best = async (sql: Sql, uid: string, kind: string) => (await sql.first<{ floor: number }>("SELECT floor FROM tower_best WHERE user_id = ? AND kind = ?", uid, kind))?.floor ?? 0;

let fights = 0;
/** A party floor begun for `uids` (prepare, then commit; `ended`: who agreed to end their own climb). */
async function begin(sql: Sql, uids: string[], now: number, ended: string[] = [], seed = 777): Promise<{ prep: PartyFloorPrep; fight: Fight; ok: boolean }> {
  const read = await preparePartyFloor(sql, uids, now, { pool: POOL, seed });
  if (!read.ok) throw new Error(`refused: ${JSON.stringify(read)}`);
  const fight: Fight = { id: `f${String(++fights).padStart(17, "0")}`, startedAt: now, lobby: "ROOMA" };
  const ok = await commitPartyFloor(sql, read.prep, fight, now, new Set(ended));
  return { prep: read.prep, fight, ok };
}
/** The room's end of a party floor for every member: the party's result. */
async function end(sql: Sql, fight: Fight, uids: string[], outcome: "won" | "lost" | "drawn", now: number) {
  for (const uid of uids) await partyFloorWrite(sql, now, fight.id, { uid, outcome }, { pool: POOL });
}

describe("one run, a copy each", () => {
  it("a party's first START makes a copy for every member: one seed, one deal, the same members; each floor's result reaches every copy", async () => {
    const sql = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const bo = await signedIn(sql, "bo@example.com");
    const { prep, fight, ok } = await begin(sql, [ann.id, bo.id], T0);
    expect(ok).toBe(true);
    expect(prep.plan).toEqual({ kind: "new", ends: [] });
    const [a, b] = [await copyOf(sql, ann.id), await copyOf(sql, bo.id)];
    expect(a!.seed).toBe(b!.seed);
    expect(a!.met).toBe(b!.met);
    expect(a!.floor).toBe(1);
    expect(membersOf(a!.members)).toEqual(membersOf(b!.members));
    expect(membersOf(a!.members)!.uids).toEqual([ann.id, bo.id]);
    expect(JSON.parse(a!.fight!)).toEqual(fight);
    // (The floor's settings: the party rule's ties always the engine's best, the floor's bosses at its strength.)
    expect(prep.settings).toMatchObject({ partyCloseCp: 0, towerFloor: 1, drawRuleByStage: ["party"], lobbySize: TOWER_PARTY.max });
    await end(sql, fight, [ann.id, bo.id], "won", T0 + 60_000);
    for (const uid of [ann.id, bo.id]) {
      const c = await copyOf(sql, uid);
      expect(c).toMatchObject({ floor: 2, status: "open", fight: null });
      expect(JSON.parse(c!.last!)).toMatchObject({ id: fight.id, outcome: "won", floor: 1, party: true });
      expect(await best(sql, uid, "party")).toBe(1);
      expect(await best(sql, uid, "solo")).toBe(0);
    }
    expect((await copyOf(sql, ann.id))!.met).toBe((await copyOf(sql, bo.id))!.met);
    // (The room's write again (its retry) changes nothing.)
    await end(sql, fight, [ann.id, bo.id], "lost", T0 + 61_000);
    expect(await copyOf(sql, ann.id)).toMatchObject({ floor: 2, status: "open" });
    // (GET: the copy with its mates by name.)
    const st = await towerState(sql, ann.id, POOL);
    expect(st.runs.party).toMatchObject({ kind: "party", floor: 2, mates: [{ uid: bo.id, name: expect.any(String) }], alone: false });
    expect(st.best.party).toBe(1);
  });

  it("a loss or a draw ends every copy; a member who left: free before the party's 2nd move, else a loss; one who never came: free", async () => {
    const sql = await world();
    const [ann, bo, cy] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com"), await signedIn(sql, "cy@example.com")];
    const { fight } = await begin(sql, [ann.id, bo.id, cy.id], T0);
    await partyFloorWrite(sql, T0 + 1, fight.id, { uid: cy.id, outcome: "left", moves: 1 }, { pool: POOL });
    expect(await copyOf(sql, cy.id)).toMatchObject({ floor: 1, status: "open", fight: null });
    await partyFloorWrite(sql, T0 + 2, fight.id, { uid: bo.id, outcome: "left", moves: BATTLE_TOWER.leaveFreeBefore }, { pool: POOL });
    expect((await sql.first<{ status: string }>("SELECT status FROM tower_runs WHERE user_id = ? AND kind = 'party'", bo.id))!.status).toBe("out");
    await partyFloorWrite(sql, T0 + 3, fight.id, { uid: ann.id, outcome: "drawn" }, { pool: POOL });
    expect((await sql.first<{ status: string }>("SELECT status FROM tower_runs WHERE user_id = ? AND kind = 'party'", ann.id))!.status).toBe("out");
  });

  it("a party floor's result is the room's: a device can't finish it or leave it, alone or not", async () => {
    const sql = await world();
    const [ann, bo] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com")];
    const { fight } = await begin(sql, [ann.id, bo.id], T0);
    const fin = await finishTowerFloor(sql, ann.id, T0 + 60_000, { fight: fight.id, outcome: "won" }, { pool: POOL, minWinMs: 0, kind: "party" });
    expect(fin.status).toBe(409);
    expect((await stopTower(sql, ann.id, T0 + 60_000, { fight: fight.id, moves: 0 }, { pool: POOL, kind: "party" })).status).toBe(409);
    const start = await startTowerFloor(sql, ann.id, T0 + 60_000, { pool: POOL, kind: "party" });
    expect(start.status).toBe(409);
    expect(start.body.party).toBe(true);
    expect(await copyOf(sql, ann.id)).toMatchObject({ floor: 1, fight: JSON.stringify(fight) });
  });

  it("a crate floor won pays its crate once an account (the room's retry never twice)", async () => {
    const sql = await world();
    const [ann, bo] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com")];
    const { fight } = await begin(sql, [ann.id, bo.id], T0);
    // (Both copies brought to floor 25 under way: the same deal as winning 24 floors.)
    let run = newRun(777, POOL);
    for (let f = 1; f < 25; f++) run = finishFloor(run, "won", POOL);
    await sql.run("UPDATE tower_runs SET floor = 25, met = ? WHERE kind = 'party'", JSON.stringify({ floors: run.floors, deck: run.deck, decks: run.decks }));
    const paid: string[] = [];
    const crate = async (uid: string, floor: number) => void paid.push(`${uid}:${floor}`);
    await partyFloorWrite(sql, T0 + 60_000, fight.id, { uid: ann.id, outcome: "won" }, { pool: POOL, crate });
    await partyFloorWrite(sql, T0 + 60_000, fight.id, { uid: ann.id, outcome: "won" }, { pool: POOL, crate });
    await partyFloorWrite(sql, T0 + 60_000, fight.id, { uid: bo.id, outcome: "lost" }, { pool: POOL, crate });
    expect(paid).toEqual([`${ann.id}:25`]);
    expect(await best(sql, ann.id, "party")).toBe(25);
  });
});

describe("teaming up again (Eric: \"how can they all team up again later from the same starting spot?\")", () => {
  async function climbed(sql: Sql, uids: string[], wins: number) {
    let t = T0;
    for (let i = 0; i < wins; i++) {
      const { fight, ok } = await begin(sql, uids, ++t);
      expect(ok).toBe(true);
      await end(sql, fight, uids, "won", (t += 60_000));
    }
    return t;
  }

  it("the run's own members (two or more) go on together from their floor; a subset of them too", async () => {
    const sql = await world();
    const [ann, bo, cy] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com"), await signedIn(sql, "cy@example.com")];
    await climbed(sql, [ann.id, bo.id, cy.id], 2);
    const seed = (await copyOf(sql, ann.id))!.seed;
    const again = await preparePartyFloor(sql, [bo.id, ann.id], T0 + 1e6, { pool: POOL });
    expect(again.ok && again.prep.plan).toMatchObject({ kind: "continue", floor: 3 });
    const { fight, ok } = await begin(sql, [bo.id, ann.id], T0 + 1e6);
    expect(ok).toBe(true);
    await end(sql, fight, [bo.id, ann.id], "won", T0 + 2e6);
    expect(await copyOf(sql, ann.id)).toMatchObject({ floor: 4, seed });
    expect(await copyOf(sql, cy.id)).toMatchObject({ floor: 3, seed });
    // (All three again: the lowest copy's floor (Cy's 3); Ann's and Bo's copies go back to it.)
    const three = await begin(sql, [ann.id, bo.id, cy.id], T0 + 3e6);
    expect(three.prep.plan).toEqual({ kind: "continue", run: membersOf((await copyOf(sql, cy.id))!.members)!.run, floor: 3 });
    expect(three.ok).toBe(true);
    for (const u of [ann.id, bo.id, cy.id]) expect(await copyOf(sql, u)).toMatchObject({ floor: 3, fight: JSON.stringify(three.fight) });
    expect(await best(sql, ann.id, "party")).toBe(3);
  });

  it("nobody new joins a run already climbed: with someone new it's a new run from floor 1, only once each member whose climb it ends agreed", async () => {
    const sql = await world();
    const [ann, bo, di] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com"), await signedIn(sql, "di@example.com")];
    await climbed(sql, [ann.id, bo.id], 2);
    const before = [await copyOf(sql, ann.id), await copyOf(sql, bo.id)];
    const read = await preparePartyFloor(sql, [ann.id, bo.id, di.id], T0 + 1e6, { pool: POOL, seed: 99 });
    expect(read.ok && read.prep.plan).toEqual({ kind: "new", ends: [{ uid: ann.id, floor: 3 }, { uid: bo.id, floor: 3 }] });
    // (Bo hasn't agreed: nothing is written, nobody's copy changes.)
    const fight: Fight = { id: "f00000000000000001", startedAt: T0, lobby: "ROOMB" };
    expect(read.ok && (await commitPartyFloor(sql, read.prep, fight, T0 + 1e6, new Set([ann.id])))).toBe(false);
    expect([await copyOf(sql, ann.id), await copyOf(sql, bo.id)]).toEqual(before);
    expect(await copyOf(sql, di.id)).toBeNull();
    // (Both agreed: the old copies go, a new run for the three from floor 1. Their party bests stay.)
    expect(read.ok && (await commitPartyFloor(sql, read.prep, fight, T0 + 1e6, new Set([ann.id, bo.id])))).toBe(true);
    for (const u of [ann.id, bo.id, di.id]) expect(await copyOf(sql, u)).toMatchObject({ floor: 1, seed: 99 });
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM tower_runs WHERE kind = 'party'"))!.n).toBe(3);
    expect(await best(sql, ann.id, "party")).toBe(2);
  });

  it("partyPlan: one person, a member with no copy, or copies of two runs: a new run; the plan reads the lowest floor", () => {
    const copy = (run: string, uids: string[], floor: number) => ({ floor, members: JSON.stringify({ run, uids }) });
    const ab = ["a", "b"];
    expect(partyPlan(["a"], new Map([["a", copy("r", ab, 4)]]))).toEqual({ kind: "new", ends: [{ uid: "a", floor: 4 }] });
    expect(partyPlan(ab, new Map([["a", copy("r", ab, 4)]]))).toEqual({ kind: "new", ends: [{ uid: "a", floor: 4 }] });
    expect(partyPlan(ab, new Map([["a", copy("r", ab, 4)], ["b", copy("s", ab, 4)]]))).toMatchObject({ kind: "new" });
    expect(partyPlan(ab, new Map([["a", copy("r", ab, 6)], ["b", copy("r", ab, 4)]]))).toEqual({ kind: "continue", run: "r", floor: 4 });
    // (A copy that doesn't name a member (an account deleted since and back is another account): new.)
    expect(partyPlan(ab, new Map([["a", copy("r", ["a"], 6)], ["b", copy("r", ab, 4)]]))).toMatchObject({ kind: "new" });
  });

  it("a member's copy under way (alone) holds the party back; a party floor whose room has gone without a result is let go, free", async () => {
    const sql = await world();
    const [ann, bo] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com")];
    const { fight } = await begin(sql, [ann.id, bo.id], T0);
    const held = await preparePartyFloor(sql, [ann.id, bo.id], T0 + 1, { pool: POOL, lobbyGone: async () => false });
    expect(held).toEqual({ ok: false, busy: ann.id, party: true });
    const gone = await preparePartyFloor(sql, [ann.id, bo.id], T0 + 1, { pool: POOL, lobbyGone: async (f) => f.id === fight.id });
    expect(gone.ok && gone.prep.plan).toMatchObject({ kind: "continue", floor: 1 });
    expect(await copyOf(sql, ann.id)).toMatchObject({ floor: 1, fight: null, status: "open" });
    // (Ann plays her copy alone meanwhile: the party waits for that floor.)
    expect((await startTowerFloor(sql, ann.id, T0 + 2, { pool: POOL, kind: "party" })).status).toBe(200);
    expect(await preparePartyFloor(sql, [ann.id, bo.id], T0 + 3, { pool: POOL })).toEqual({ ok: false, busy: ann.id, party: false });
  });
});

describe("alone after disbanding", () => {
  it("a member plays their copy on alone (the device's word, the solo best); the run's members can still climb it together", async () => {
    const sql = await world();
    const [ann, bo] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com")];
    const first = await begin(sql, [ann.id, bo.id], T0);
    await end(sql, first.fight, [ann.id, bo.id], "won", T0 + 60_000);
    const start = await startTowerFloor(sql, ann.id, T0 + 70_000, { pool: POOL, kind: "party" });
    expect(start.status).toBe(200);
    const f = (start.body as { fight: { id: string }; floor: number }).fight.id;
    expect((start.body as { floor: number }).floor).toBe(2);
    expect(membersOf((await copyOf(sql, ann.id))!.members)!.alone).toBe(true);
    const won = await finishTowerFloor(sql, ann.id, T0 + 200_000, { fight: f, outcome: "won" }, { pool: POOL, minWinMs: BATTLE_TOWER.soloWinMinSeconds * 1000, kind: "party" });
    expect(won.status).toBe(200);
    expect(won.body).toMatchObject({ outcome: "won", floor: 2, status: "open", run: { kind: "party", floor: 3, alone: true }, best: 2 });
    // (Its floors won together stay the party best's; the one won alone is the solo best's. Bo's copy didn't move.)
    expect([await best(sql, ann.id, "party"), await best(sql, ann.id, "solo")]).toEqual([1, 2]);
    expect(await copyOf(sql, bo.id)).toMatchObject({ floor: 2 });
    // (The same result again: answered the same.)
    expect((await finishTowerFloor(sql, ann.id, T0 + 201_000, { fight: f, outcome: "won" }, { pool: POOL, minWinMs: 0, kind: "party" })).status).toBe(200);
    // (Together again: from Bo's floor 2, Ann's copy back to it and no longer alone.)
    const again = await begin(sql, [ann.id, bo.id], T0 + 300_000);
    expect(again.prep.plan).toMatchObject({ kind: "continue", floor: 2 });
    expect(again.ok).toBe(true);
    expect(await copyOf(sql, ann.id)).toMatchObject({ floor: 2 });
    expect(membersOf((await copyOf(sql, ann.id))!.members)!.alone).toBeUndefined();
    // (A solo run beside it is untouched: one open run of each kind.)
    expect((await towerState(sql, ann.id, POOL)).runs.solo).toBeNull();
  });
});

describe("the sign-in merge and deleting an account", () => {
  it("merge: a guest's id in the others' copies becomes the account's (the same person: the run's members still climb it); delete: gone from them", async () => {
    const sql = await world();
    const guest = (await createGuest(sql, T0, "Player")).user;
    const bo = await signedIn(sql, "bo@example.com");
    const cy = await signedIn(sql, "cy@example.com");
    const { fight } = await begin(sql, [guest.id, bo.id, cy.id], T0);
    await end(sql, fight, [guest.id, bo.id, cy.id], "won", T0 + 60_000);
    const acct = "acct-of-the-guest";
    await sql.batch(towerMoves(guest.id, acct, T0 + 1));
    for (const u of [bo.id, cy.id, acct]) expect(membersOf((await copyOf(sql, u))!.members)!.uids).toEqual([acct, bo.id, cy.id]);
    expect(await best(sql, acct, "party")).toBe(1);
    // (Bo deletes their account: their copy and best go, and their id from Cy's copy.)
    await deleteAccount(sql, bo, T0 + 2);
    expect(await copyOf(sql, bo.id)).toBeNull();
    expect(membersOf((await copyOf(sql, cy.id))!.members)!.uids).toEqual([acct, cy.id]);
    expect(membersOf((await copyOf(sql, acct))!.members)!.uids).toEqual([acct, cy.id]);
    // (Cy's download: how many climbed it, never who.)
    const data = (await accountDownload(sql, cy, T0 + 3)) as { tower: { runs: Record<string, unknown>[] } };
    expect(data.tower.runs[0]).toMatchObject({ kind: "party", climbers: 2, alone: false });
    expect(JSON.stringify(data.tower)).not.toContain(acct);
  });
});

describe("the party (squads-party.ts, kind \"tower\")", () => {
  function party() {
    let now = T0;
    const sent: { to: string; msg: PartyServerMessage | Record<string, unknown> }[] = [];
    let n = 0;
    const core = new PartyCore(newPartyRecord("TOWER", now, "tower"), { now: () => now, send: (to, msg) => sent.push({ to, msg }), random: () => `r${++n}` });
    const join = (uid: string, name: string) => core.connect(undefined, { name, device: "phone", v: SQUADS_PROTOCOL, userId: uid });
    const view = (id: string) => core.view(id);
    return { core, join, view, sent, tick: (ms: number) => (now += ms) };
  }

  it("up to TOWER_PARTY.max, one seat an account, accounts only, no bots; the plan waits for two", () => {
    const P = party();
    const a = P.join("ua", "Ann");
    expect(a.ok).toBe(true);
    expect(P.join("ua", "Ann")).toEqual(a);
    expect(P.core.connect(undefined, { name: "Guest", device: "phone", v: SQUADS_PROTOCOL })).toMatchObject({ ok: false });
    const lead = (a as { memberId: string }).memberId;
    P.core.message(lead, { t: "bot", add: true }, { test: true });
    expect(P.core.record.members.length).toBe(1);
    expect(P.view(lead).tower).toEqual({ plan: { kind: "wait", message: TOWER_PARTY_LINES.needTwo }, open: false });
    for (const [u, nm] of [["ub", "Bo"], ["uc", "Cy"], ["ud", "Di"]]) expect(P.join(u!, nm!).ok).toBe(true);
    expect(P.join("ue", "Ed")).toEqual({ ok: false, message: "This party is full." });
    expect(P.view(lead)).toMatchObject({ kind: "tower", max: TOWER_PARTY.max });
  });

  it("START only for the plan read for these people, once everyone's READY; a plan that ends the leader's climb needs the leader's confirm", () => {
    const P = party();
    const lead = (P.join("ua", "Ann") as { memberId: string }).memberId;
    const bo = (P.join("ub", "Bo") as { memberId: string }).memberId;
    expect(P.core.towerPlanStale()).toBe(true);
    expect(P.core.towerPeople()).toEqual(["ua", "ub"]);
    P.core.message(bo, { t: "ready", on: true });
    P.core.message(lead, { t: "start" });
    expect(P.core.takeStart()).toBeNull();
    // (The plan read: a new run that ends Ann's own climb on floor 6. Bo un-readied by the new plan.)
    P.core.setTowerPlan({ key: "ua,ub", plan: { kind: "new", ends: [{ uid: "ua", floor: 6 }] } });
    expect(P.view(bo).tower!.plan).toEqual({ kind: "new", ends: [{ id: lead, floor: 6 }] });
    expect(P.core.record.members.find((m) => m.id === bo)!.ready).toBe(false);
    P.core.message(bo, { t: "ready", on: true });
    P.core.message(lead, { t: "start" });
    expect(P.core.takeStart()).toBeNull();
    P.core.message(lead, { t: "start", confirm: true });
    expect(P.core.takeStart()).toMatchObject({ members: [{ userId: "ua" }, { userId: "ub" }] });
    // (A plan read for other people than are here now is never used.)
    const Q = party();
    const ql = (Q.join("ua", "Ann") as { memberId: string }).memberId;
    Q.join("ub", "Bo");
    Q.core.setTowerPlan({ key: "ua,uc", plan: { kind: "continue", floor: 3 } });
    expect(Q.view(ql).tower!.plan).toEqual({ kind: "wait", message: TOWER_PARTY_LINES.reading });
  });

  it("Open party: its line once, the leader's; it lapses when the party fills, starts, or its leader leaves", () => {
    const P = party();
    const lead = (P.join("ua", "Ann") as { memberId: string }).memberId;
    const bo = (P.join("ub", "Bo") as { memberId: string }).memberId;
    P.core.message(bo, { t: "open", room: "town" });
    expect(P.core.takeOpen()).toBeNull();
    P.core.message(lead, { t: "open", room: "town" });
    expect(P.core.takeOpen()).toEqual({ name: "Ann", free: 2, room: "town" });
    P.core.openPosted(41);
    expect(P.view(lead).tower!.open).toBe(true);
    expect(P.core.takeLapsedOpen()).toBeNull();
    P.join("uc", "Cy");
    expect(P.core.takeLapsedOpen()).toBeNull();
    P.join("ud", "Di");
    expect(P.core.takeLapsedOpen()).toEqual({ line: 41, room: "town" });
    expect(P.view(lead).tower!.open).toBe(false);
    // (Its leader leaving: the party passes on, the line with their name goes.)
    const Q = party();
    const ql = (Q.join("ua", "Ann") as { memberId: string }).memberId;
    Q.join("ub", "Bo");
    Q.core.message(ql, { t: "open" });
    Q.core.openPosted(7);
    Q.core.message(ql, { t: "leave" });
    expect(Q.core.takeLapsedOpen()).toEqual({ line: 7, room: "town" });
  });
});

describe("the floor's match room: each copy's end (LobbyCore.takeTowerEnds)", () => {
  it("a leave as it happens, with the party's moves by then; the party's result for those still in it at the end; a free leave for one who never came", () => {
    let now = 1_000_000;
    const run = newRun(5, POOL);
    const overrides = JSON.parse(JSON.stringify(towerPartySettings(floorSettings(run))));
    const start = { id: 1, members: [0, 1, 2].map((i) => ({ id: `m${i}`, seat: i, pass: `pass${i}`, userId: `u${i}` })), bots: 0, leaderSeat: 0, boss: "", difficulty: "normal" as const };
    const core = new LobbyCore(
      newLobbyRecord("FLOOR", now, overrides, partyLobby(start, "TOWER", now, { fight: "f1" })),
      { now: () => now, send: () => undefined },
      library,
      mulberry32(3),
      { ...DEFAULT_SETTINGS, ...overrides, boardIntroSeconds: 0 } as Settings,
    );
    const join = (seat: number) => core.connect(undefined, `M${seat}`, "phone", false, 1500, undefined, `u${seat}`, null, null, false, { pass: `pass${seat}`, seat });
    const advance = (ms: number) => {
      const to = now + ms;
      while (core.nextAlarm !== null && core.nextAlarm <= to) {
        now = Math.max(now, core.nextAlarm);
        core.alarm();
      }
      now = to;
    };
    expect(join(0).ok).toBe(true);
    expect(join(1).ok).toBe(true);
    // (Seat 2 never comes: the floor begins without them once the wait is over.)
    advance(60_000);
    advance(60_000);
    expect(core.record.phase).not.toBe("lobby");
    expect(core.takeTowerEnds()).toEqual([]);
    core.message("p2", { t: "leave" });
    expect(core.takeTowerEnds()).toEqual([{ uid: "u1", outcome: "left", moves: 0 }]);
    expect(core.takeTowerEnds()).toEqual([]);
    // (The match ends, the party's win: the one still in it, the party's result; seat 2 never came: a free leave.)
    const r = core as unknown as { runner: { state: { boss: { result: string | null } } } };
    expect(r.runner.state.boss).toBeTruthy();
    r.runner.state.boss.result = "crowd";
    core.record.phase = "results";
    expect(core.takeTowerEnds()).toEqual([
      { uid: "u0", outcome: "won" },
      { uid: "u2", outcome: "left", moves: 0 },
    ]);
    expect(core.takeTowerEnds()).toEqual([]);
  });
});
