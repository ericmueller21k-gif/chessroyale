import { describe, expect, it, vi } from "vitest";
import { BATTLE_TOWER, DEFAULT_SETTINGS, TOWER_PARTY, TOWN_CHAT, finishFloor, floorSettings, mulberry32, newRun, towerPartySettings, towerPool, type Settings } from "@chessroyale/core";
import { SQUADS_PROTOCOL, type PartyServerMessage } from "@chessroyale/chess/squads";
import { legalMoves, type BoardScore, type MatchRunner, type ServerMessage } from "@chessroyale/chess";
import { createGuest, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { commitPartyFloor, finishTowerFloor, holdsPartyCopy, membersOf, partyFloorWrite, partyPlan, preparePartyFloor, startTowerFloor, stopTower, towerMoves, towerState, towerUnlocks, type Fight, type PartyFloorPrep } from "../src/tower.ts";
import { TownChat } from "../src/town-chat.ts";
import { forgetTownCache, partyCodesOf, townOpenParties } from "../src/town-chat-api.ts";
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
async function begin(sql: Sql, uids: string[], now: number, ended: string[] = [], seed = 777, pool = POOL): Promise<{ prep: PartyFloorPrep; fight: Fight; ok: boolean }> {
  const read = await preparePartyFloor(sql, uids, now, { pool, seed });
  if (!read.ok) throw new Error(`refused: ${JSON.stringify(read)}`);
  const fight: Fight = { id: `f${String(++fights).padStart(17, "0")}`, startedAt: now, lobby: "ROOMA" };
  const ok = await commitPartyFloor(sql, read.prep, fight, now, new Set(ended));
  return { prep: read.prep, fight, ok };
}
/** The room's end of a party floor for every member: the party's result. */
async function end(sql: Sql, fight: Fight, uids: string[], outcome: "won" | "lost" | "drawn", now: number, pool = POOL) {
  for (const uid of uids) await partyFloorWrite(sql, now, fight.id, { uid, outcome }, { pool });
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

  it("a loss or a draw costs a life and the copy climbs on (Nov 20); a member who left: free before the party's 2nd move, else a loss (a life); one who never came: free", async () => {
    const sql = await world();
    const [ann, bo, cy] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com"), await signedIn(sql, "cy@example.com")];
    const { fight } = await begin(sql, [ann.id, bo.id, cy.id], T0);
    await partyFloorWrite(sql, T0 + 1, fight.id, { uid: cy.id, outcome: "left", moves: 1 }, { pool: POOL });
    expect(await copyOf(sql, cy.id)).toMatchObject({ floor: 1, status: "open", fight: null });
    await partyFloorWrite(sql, T0 + 2, fight.id, { uid: bo.id, outcome: "left", moves: BATTLE_TOWER.leaveFreeBefore }, { pool: POOL });
    expect(await copyOf(sql, bo.id)).toMatchObject({ floor: 2, status: "open", fight: null });
    await partyFloorWrite(sql, T0 + 3, fight.id, { uid: ann.id, outcome: "drawn" }, { pool: POOL });
    expect(await copyOf(sql, ann.id)).toMatchObject({ floor: 2, status: "open", fight: null });
    // (The draw and the counted leave: the same floor lost, the same deal on both copies; neither is a party best.)
    expect((await copyOf(sql, ann.id))!.met).toBe((await copyOf(sql, bo.id))!.met);
    expect(JSON.parse((await copyOf(sql, ann.id))!.met)).toMatchObject({ lost: [1], won: 0 });
    expect((await towerState(sql, ann.id, POOL)).runs.party).toMatchObject({ floor: 2, lives: 1, lost: [1] });
    expect(await best(sql, ann.id, "party")).toBe(0);
  });

  it("lives (Nov 20): one count for the party, every copy alike; climbing on together again, the fewest any copy holds (in any seat order), in the plan; the third loss ends every copy", async () => {
    const sql = await world();
    const [ann, bo] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com")];
    const uids = [ann.id, bo.id];
    let now = T0;
    // Floor 1 won, floor 2 lost: both copies on floor 3, one life left, alike.
    let f = await begin(sql, uids, (now += 1000));
    await end(sql, f.fight, uids, "won", (now += 1000));
    f = await begin(sql, uids, (now += 1000));
    expect(f.prep.plan).toMatchObject({ kind: "continue", floor: 2 });
    await end(sql, f.fight, uids, "lost", (now += 1000));
    for (const uid of uids) expect((await towerState(sql, uid, POOL)).runs.party).toMatchObject({ floor: 3, lives: 1, lost: [2], fight: null });
    expect((await copyOf(sql, ann.id))!.met).toBe((await copyOf(sql, bo.id))!.met);
    // Floor 3: the party plays on with one life; Bo leaves after the party's 2nd move (a loss: his last life), Ann's party wins it.
    f = await begin(sql, uids, (now += 1000));
    expect(f.prep.run.lost).toEqual([2]);
    await partyFloorWrite(sql, (now += 1000), f.fight.id, { uid: bo.id, outcome: "left", moves: 5 }, { pool: POOL });
    await partyFloorWrite(sql, now, f.fight.id, { uid: ann.id, outcome: "won" }, { pool: POOL });
    expect((await towerState(sql, ann.id, POOL)).runs.party).toMatchObject({ floor: 4, lives: 1, lost: [2] });
    expect((await towerState(sql, bo.id, POOL)).runs.party).toMatchObject({ floor: 4, lives: 0, lost: [2, 3] });
    expect([await best(sql, ann.id, "party"), await best(sql, bo.id, "party")]).toEqual([3, 1]);
    // Together again on floor 4: the fewest lives (Bo's: nobody is given back a life they spent), whoever sits first.
    for (const order of [uids, [bo.id, ann.id]]) {
      const read = await preparePartyFloor(sql, order, now, { pool: POOL });
      expect(read.ok && read.prep.plan.kind === "continue" && read.prep.floor).toBe(4);
      expect(read.ok && read.prep.run.lost).toEqual([2, 3]);
    }
    f = await begin(sql, uids, (now += 1000));
    for (const uid of uids) expect((await towerState(sql, uid, POOL)).runs.party).toMatchObject({ floor: 4, lives: 0, lost: [2, 3], fight: { id: f.fight.id } });
    // Floor 4 lost: the third loss, every copy out on it.
    await end(sql, f.fight, uids, "lost", (now += 1000));
    for (const uid of uids) {
      const row = (await sql.first<{ status: string; floor: number; met: string; last: string }>("SELECT status, floor, met, last FROM tower_runs WHERE user_id = ? AND kind = 'party'", uid))!;
      expect([row.status, row.floor, JSON.parse(row.met).lost, JSON.parse(row.last).lost]).toEqual(["out", 4, [2, 3, 4], [2, 3, 4]]);
    }
  });

  it("a life spent in the party's room is never given back when the party goes back below it (one member's free leave kept their copy there: the review of #839, finding 1)", async () => {
    const sql = await world();
    const [ann, bo] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com")];
    const uids = [ann.id, bo.id];
    let f = await begin(sql, uids, T0);
    await end(sql, f.fight, uids, "won", T0 + 60_000);
    // Floor 2: Ann leaves before the party's 2nd move (free: her copy stays on floor 2); Bo plays on and his party loses it.
    f = await begin(sql, uids, T0 + 70_000);
    await partyFloorWrite(sql, T0 + 71_000, f.fight.id, { uid: ann.id, outcome: "left", moves: BATTLE_TOWER.leaveFreeBefore - 1 }, { pool: POOL });
    await partyFloorWrite(sql, T0 + 130_000, f.fight.id, { uid: bo.id, outcome: "lost" }, { pool: POOL });
    expect((await towerState(sql, ann.id, POOL)).runs.party).toMatchObject({ floor: 2, lives: 2, lost: [] });
    expect((await towerState(sql, bo.id, POOL)).runs.party).toMatchObject({ floor: 3, lives: 1, lost: [2] });
    // Together again: back to Ann's floor 2 (Bo's copy goes back from 3), with Bo's life still spent, whoever sits first.
    for (const order of [uids, [bo.id, ann.id]]) {
      const read = await preparePartyFloor(sql, order, T0 + 140_000, { pool: POOL });
      expect(read.ok && read.prep.plan).toMatchObject({ kind: "continue", floor: 2, back: [{ uid: bo.id, floor: 3 }] });
      expect(read.ok && read.prep.run.lost).toEqual([2]);
    }
    f = await begin(sql, uids, T0 + 150_000);
    for (const uid of uids) expect((await towerState(sql, uid, POOL)).runs.party).toMatchObject({ floor: 2, lives: 1, lost: [2], fight: { id: f.fight.id } });
    // (Floor 2 won this time: on to 3 with the one life; the party best is the floor won.)
    await end(sql, f.fight, uids, "won", T0 + 210_000);
    for (const uid of uids) expect((await towerState(sql, uid, POOL)).runs.party).toMatchObject({ floor: 3, lives: 1, lost: [2] });
    expect([await best(sql, ann.id, "party"), await best(sql, bo.id, "party")]).toEqual([2, 2]);
  });

  it("a party of three: one sits a floor out (free), one leaves it after the party's 2nd move, one's party wins it; together again on the floor sat out, the counted leave's life stays spent", async () => {
    const sql = await world();
    const [ann, bo, cy] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com"), await signedIn(sql, "cy@example.com")];
    const uids = [ann.id, bo.id, cy.id];
    const f = await begin(sql, uids, T0);
    await partyFloorWrite(sql, T0 + 1_000, f.fight.id, { uid: cy.id, outcome: "left", moves: 0 }, { pool: POOL });
    await partyFloorWrite(sql, T0 + 30_000, f.fight.id, { uid: bo.id, outcome: "left", moves: BATTLE_TOWER.leaveFreeBefore }, { pool: POOL });
    await partyFloorWrite(sql, T0 + 60_000, f.fight.id, { uid: ann.id, outcome: "won" }, { pool: POOL });
    const read = await preparePartyFloor(sql, uids, T0 + 70_000, { pool: POOL });
    expect(read.ok && read.prep.plan).toMatchObject({ kind: "continue", floor: 1 });
    expect(read.ok && read.prep.run.lost).toEqual([1]);
  });

  it("lives spent playing a party copy on alone come back when the party climbs on together (they go with the floors played alone, which never count for the party)", async () => {
    const sql = await world();
    const [ann, bo] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com")];
    const first = await begin(sql, [ann.id, bo.id], T0);
    await end(sql, first.fight, [ann.id, bo.id], "won", T0 + 60_000);
    // Ann alone: floor 2 lost (a life), floor 3 won.
    let t = T0 + 70_000;
    for (const outcome of ["lost", "won"] as const) {
      const s = await startTowerFloor(sql, ann.id, t, { pool: POOL, kind: "party" });
      t += BATTLE_TOWER.soloWinMinSeconds * 1000 + 1;
      expect((await finishTowerFloor(sql, ann.id, t++, { fight: (s.body as { fight: { id: string } }).fight.id, outcome }, { pool: POOL, minWinMs: 0, kind: "party" })).status).toBe(200);
    }
    expect((await towerState(sql, ann.id, POOL)).runs.party).toMatchObject({ floor: 4, lives: 1, lost: [2], alone: true });
    const again = await begin(sql, [bo.id, ann.id], t + 1);
    expect(again.prep.plan).toMatchObject({ kind: "continue", floor: 2, back: [{ uid: ann.id, floor: 4 }] });
    expect(again.prep.run.lost).toEqual([]);
    expect((await towerState(sql, ann.id, POOL)).runs.party).toMatchObject({ floor: 2, lives: 2, lost: [] });
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

describe("the Stranger's unlock in a party (Eric, Nov 27: \"you have to beat him to unlock him\")", () => {
  it("his floor 10 won by the party unlocks each member in it at the end; one who left it after the party's 2nd move (a life) doesn't; a copy played on alone that wins it does", async () => {
    // (A test server's pool: him before his art, on his floors.)
    const HIM = towerPool(undefined, undefined, true);
    const sql = await world();
    const [ann, bo, cy] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com"), await signedIn(sql, "cy@example.com")];
    const all = [ann.id, bo.id, cy.id];
    let t = T0;
    for (let f = 1; f < 10; f++) {
      const { fight, ok } = await begin(sql, all, (t += 1000), [], 777, HIM);
      expect(ok).toBe(true);
      await end(sql, fight, all, "won", (t += 1000), HIM);
    }
    expect((await towerState(sql, ann.id, HIM)).runs.party).toMatchObject({ floor: 10, bosses: ["stranger"] });
    // Cy plays floor 10 on alone (the device's word, as a solo floor) and beats him.
    const start = await startTowerFloor(sql, cy.id, (t += 1000), { pool: HIM, kind: "party" });
    expect((start.body as { bosses: string[] }).bosses).toEqual(["stranger"]);
    const f = (start.body as { fight: { id: string } }).fight.id;
    expect((await finishTowerFloor(sql, cy.id, (t += 1000), { fight: f, outcome: "won" }, { pool: HIM, minWinMs: 0, kind: "party" })).status).toBe(200);
    expect(await towerUnlocks(sql, cy.id)).toEqual(["stranger"]);
    // Ann and Bo take it on together: Bo leaves after the party's 2nd move (a loss, a life), Ann's party wins it.
    const { fight, ok } = await begin(sql, [ann.id, bo.id], (t += 1000), [], 777, HIM);
    expect(ok).toBe(true);
    await partyFloorWrite(sql, (t += 1000), fight.id, { uid: bo.id, outcome: "left", moves: BATTLE_TOWER.leaveFreeBefore }, { pool: HIM });
    await partyFloorWrite(sql, (t += 1000), fight.id, { uid: ann.id, outcome: "won" }, { pool: HIM });
    expect(await copyOf(sql, bo.id)).toMatchObject({ floor: 11, status: "open" });
    expect([await towerUnlocks(sql, ann.id), await towerUnlocks(sql, bo.id)]).toEqual([["stranger"], []]);
    expect((await towerState(sql, bo.id, HIM)).unlocked).toEqual([]);
    // (The room's write again changes nothing.)
    await partyFloorWrite(sql, (t += 1000), fight.id, { uid: bo.id, outcome: "won" }, { pool: HIM });
    expect(await towerUnlocks(sql, bo.id)).toEqual([]);
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
    // (All three again: the lowest copy's floor (Cy's 3); Ann's and Bo's copies go back to it, each named.)
    const three = await begin(sql, [ann.id, bo.id, cy.id], T0 + 3e6);
    expect(three.prep.plan).toEqual({ kind: "continue", run: membersOf((await copyOf(sql, cy.id))!.members)!.run, floor: 3, back: [{ uid: ann.id, floor: 4 }, { uid: bo.id, floor: 4 }] });
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
    expect(partyPlan(ab, new Map([["a", copy("r", ab, 6)], ["b", copy("r", ab, 4)]]))).toEqual({ kind: "continue", run: "r", floor: 4, back: [{ uid: "a", floor: 6 }] });
    // (The party's own floor (`party`), never a floor won alone above it: the review of #835, finding 1.)
    const alone = (floor: number, party: number) => ({ floor, members: JSON.stringify({ run: "r", uids: ab, alone: true, party }) });
    expect(partyPlan(ab, new Map([["a", alone(30, 5)], ["b", alone(9, 5)]]))).toEqual({ kind: "continue", run: "r", floor: 5, back: [{ uid: "a", floor: 30 }, { uid: "b", floor: 9 }] });
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

describe("the party's own floor (the review of #835, finding 1: floors won alone never carry a party up)", () => {
  it("floors won alone never carry a re-formed party above the floor it reached together (no forged crates or party bests)", async () => {
    const sql = await world();
    const [ann, bo] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com")];
    const first = await begin(sql, [ann.id, bo.id], T0);
    for (const u of [ann.id, bo.id]) await partyFloorWrite(sql, T0 + 1, first.fight.id, { uid: u, outcome: "left", moves: 0 }, { pool: POOL });
    const partyDeal = (await copyOf(sql, ann.id))!.met;
    let t = T0 + 10;
    for (const uid of [ann.id, bo.id])
      for (let i = 0; i < 24; i++) {
        const s = await startTowerFloor(sql, uid, t, { pool: POOL, kind: "party" });
        t += BATTLE_TOWER.soloWinMinSeconds * 1000 + 1;
        await finishTowerFloor(sql, uid, t++, { fight: (s.body as { fight: { id: string } }).fight.id, outcome: "won" }, { pool: POOL, minWinMs: BATTLE_TOWER.soloWinMinSeconds * 1000, kind: "party" });
      }
    expect(await copyOf(sql, ann.id)).toMatchObject({ floor: 25 });
    // (Today: { kind: "continue", floor: 25 }, and one party win there paid the floor-25 crate and a party best of 25.)
    const again = await preparePartyFloor(sql, [ann.id, bo.id], t + 10, { pool: POOL });
    expect(again.ok && again.prep.plan).toMatchObject({ kind: "continue", floor: 1, back: [{ uid: ann.id, floor: 25 }, { uid: bo.id, floor: 25 }] });
    // (Begun: both copies back on floor 1 with the party's own deal, no longer alone; a win there pays no crate, and the party best is 1.)
    const fight: Fight = { id: "f00000000000000099", startedAt: t + 10, lobby: "ROOMC" };
    expect(again.ok && (await commitPartyFloor(sql, again.prep, fight, t + 10, new Set()))).toBe(true);
    for (const u of [ann.id, bo.id]) {
      const c = (await copyOf(sql, u))!;
      expect(c.floor).toBe(1);
      expect(JSON.parse(c.met).floors).toEqual(JSON.parse(partyDeal).floors);
      expect(membersOf(c.members)).toEqual({ run: membersOf(c.members)!.run, uids: [ann.id, bo.id], party: 1 });
    }
    const paid: string[] = [];
    for (const u of [ann.id, bo.id]) await partyFloorWrite(sql, t + 70_000, fight.id, { uid: u, outcome: "won" }, { pool: POOL, crate: async (uid, floor) => void paid.push(`${uid}:${floor}`) });
    expect(paid).toEqual([]);
    expect([await best(sql, ann.id, "party"), await best(sql, bo.id, "party")]).toEqual([1, 1]);
    expect(membersOf((await copyOf(sql, ann.id))!.members)!.party).toBe(2);
  });

  it("one member played on alone, the other didn't: on from the other's copy (the party's floor), the one alone going back to it", async () => {
    const sql = await world();
    const [ann, bo] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com")];
    const first = await begin(sql, [ann.id, bo.id], T0);
    await end(sql, first.fight, [ann.id, bo.id], "won", T0 + 60_000);
    let t = T0 + 70_000;
    for (let i = 0; i < 3; i++) {
      const s = await startTowerFloor(sql, ann.id, t, { pool: POOL, kind: "party" });
      t += BATTLE_TOWER.soloWinMinSeconds * 1000 + 1;
      expect((await finishTowerFloor(sql, ann.id, t++, { fight: (s.body as { fight: { id: string } }).fight.id, outcome: "won" }, { pool: POOL, minWinMs: 0, kind: "party" })).status).toBe(200);
    }
    expect(membersOf((await copyOf(sql, ann.id))!.members)).toMatchObject({ alone: true, party: 2 });
    const again = await begin(sql, [bo.id, ann.id], t + 1);
    expect(again.prep.plan).toMatchObject({ kind: "continue", floor: 2, back: [{ uid: ann.id, floor: 5 }] });
    expect(again.ok).toBe(true);
    expect((await copyOf(sql, ann.id))!.met).toBe((await copyOf(sql, bo.id))!.met);
  });
});

describe("the sign-in merge and deleting an account", () => {
  it("a seat whose account has been deleted gets no copy, and its id goes into nobody's members (the review of #835, finding 5)", async () => {
    const sql = await world();
    const [ann, bo, cy] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com"), await signedIn(sql, "cy@example.com")];
    await deleteAccount(sql, bo, T0);
    expect(await preparePartyFloor(sql, [ann.id, bo.id], T0 + 1, { pool: POOL })).toEqual({ ok: false, gone: bo.id });
    // (Deleted between the plan and its START's commit: the whole batch is refused, nobody's copy written.)
    const read = await preparePartyFloor(sql, [ann.id, cy.id], T0 + 2, { pool: POOL, seed: 5 });
    expect(read.ok).toBe(true);
    await deleteAccount(sql, cy, T0 + 3);
    const fight: Fight = { id: "f00000000000000098", startedAt: T0 + 4, lobby: "ROOMD" };
    expect(read.ok && (await commitPartyFloor(sql, read.prep, fight, T0 + 4, new Set()))).toBe(false);
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM tower_runs"))!.n).toBe(0);
  });

  it("merge: a copy naming both the guest and the account it signs in to names the account once; the statement only when the guest holds a party copy (finding 8)", async () => {
    const sql = await world();
    const guest = (await createGuest(sql, T0, "Player")).user;
    const acct = await signedIn(sql, "ann@example.com");
    const cy = await signedIn(sql, "cy@example.com");
    // (Where signing in isn't asked for: the guest and the account it later signs in to climbed one run with Cy.)
    const { fight } = await begin(sql, [guest.id, acct.id, cy.id], T0);
    await end(sql, fight, [guest.id, acct.id, cy.id], "won", T0 + 60_000);
    await sql.batch(towerMoves(guest.id, acct.id, T0 + 1, { party: await holdsPartyCopy(sql, guest.id) }));
    expect(membersOf((await copyOf(sql, cy.id))!.members)!.uids).toEqual([acct.id, cy.id]);
    expect(membersOf((await copyOf(sql, acct.id))!.members)!.uids).toEqual([acct.id, cy.id]);
    const data = (await accountDownload(sql, cy, T0 + 2)) as { tower: { runs: Record<string, unknown>[] } };
    expect(data.tower.runs[0]).toMatchObject({ climbers: 2 });
    // (A guest with no party copy: no statement reads the party copies.)
    expect(await holdsPartyCopy(sql, (await createGuest(sql, T0, "Player")).user.id)).toBe(false);
    expect(towerMoves("g", "a", 1).some((x) => x.sql.includes("json_each"))).toBe(false);
    expect(towerMoves("g", "a", 1, { party: true }).some((x) => x.sql.includes("json_each"))).toBe(true);
  });

  it("merge: a guest's id in the others' copies becomes the account's (the same person: the run's members still climb it); delete: gone from them", async () => {
    const sql = await world();
    const guest = (await createGuest(sql, T0, "Player")).user;
    const bo = await signedIn(sql, "bo@example.com");
    const cy = await signedIn(sql, "cy@example.com");
    const { fight } = await begin(sql, [guest.id, bo.id, cy.id], T0);
    await end(sql, fight, [guest.id, bo.id, cy.id], "won", T0 + 60_000);
    const acct = "acct-of-the-guest";
    expect(await holdsPartyCopy(sql, guest.id)).toBe(true);
    await sql.batch(towerMoves(guest.id, acct, T0 + 1, { party: true }));
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
    expect(P.core.takeOpen()).toEqual({ uid: "ua", name: "Ann", free: 2, room: "town" });
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

describe("the party, after the review of #835", () => {
  function party() {
    let now = T0;
    const sent: { to: string; msg: PartyServerMessage | Record<string, unknown> }[] = [];
    let n = 0;
    const core = new PartyCore(newPartyRecord("TOWER", now, "tower"), { now: () => now, send: (to, msg) => sent.push({ to, msg }), random: () => `r${++n}` });
    const join = (uid: string, name: string) => (core.connect(undefined, { name, device: "phone", v: SQUADS_PROTOCOL, userId: uid }) as { memberId: string }).memberId;
    return { core, join, sent, tick: (ms: number) => (now += ms), now: () => now };
  }
  /** Everyone ready for `plan` and the leader's START (with `confirm`): the floor's room made (placedIn). */
  function started(P: ReturnType<typeof party>, lead: string, others: string[], key: string) {
    P.core.setTowerPlan({ key, plan: { kind: "continue", floor: 3, back: [] } });
    for (const o of others) P.core.message(o, { t: "ready", on: true });
    P.core.message(lead, { t: "start" });
    const s = P.core.takeStart()!;
    P.core.placedIn("FLOOR", s.id);
    return s;
  }

  it("3 (12d): Open party's line lapses with the town's lines (TOWN_CHAT.lineMs after it went up): the button's live again, and the alarm is set for it", () => {
    const P = party();
    const lead = P.join("ua", "Ann");
    P.core.message(lead, { t: "open", room: "town" });
    expect(P.core.takeOpen()).toEqual({ uid: "ua", name: "Ann", free: 3, room: "town" });
    P.tick(500);
    P.core.openPosted(12);
    expect(P.core.nextAlarm).toBe(P.now() + TOWN_CHAT.lineMs);
    P.tick(TOWN_CHAT.lineMs - 1);
    expect(P.core.takeLapsedOpen()).toBeNull();
    expect(P.core.view(lead).tower!.open).toBe(true);
    P.tick(1);
    expect(P.core.takeLapsedOpen()).toEqual({ line: 12, room: "town" });
    expect(P.core.view(lead).tower!.open).toBe(false);
    expect(P.core.nextAlarm).toBeNull();
    // (Open party again: a new line to post.)
    P.core.message(lead, { t: "open", room: "town" });
    expect(P.core.takeOpen()).toMatchObject({ uid: "ua" });
  });

  it("2: the town's refusal (a chat ban, too soon) drops the line and tells the leader its words", () => {
    const P = party();
    const lead = P.join("ua", "Ann");
    P.core.message(lead, { t: "open" });
    expect(P.core.takeOpen()).not.toBeNull();
    P.core.openRefused(TOWER_PARTY_LINES.openWait(42_000));
    expect(P.core.view(lead).tower!.open).toBe(false);
    expect(P.sent.filter((x) => x.to === lead).map((x) => x.msg)).toContainEqual({ t: "error", message: "You can open a party to the town once a minute. Try again in 42 s." });
    expect(P.core.takeOpen()).toBeNull();
  });

  it("6: Kick is greyed while a floor is under way (START to the room's end), live again after; an Open party after a floor stands", () => {
    const P = party();
    const lead = P.join("ua", "Ann");
    const bo = P.join("ub", "Bo");
    const cy = P.join("uc", "Cy");
    const s = started(P, lead, [bo, cy], "ua,ub,uc");
    expect(P.core.view(lead).tower!.floor).toBe(true);
    P.core.message(lead, { t: "kick", id: bo });
    expect(P.core.record.members.map((m) => m.userId)).toEqual(["ua", "ub", "uc"]);
    // (Open party isn't taken during a floor.)
    P.core.message(lead, { t: "open" });
    expect(P.core.takeOpen()).toBeNull();
    P.core.battleOver(s.id);
    expect(P.core.view(lead).tower!.floor).toBeUndefined();
    P.core.message(lead, { t: "kick", id: bo });
    expect(P.core.record.members.map((m) => m.userId)).toEqual(["ua", "uc"]);
    // (After a floor (the party still "placed"), its line goes up and stands: it lapsed at once before the review.)
    P.core.message(lead, { t: "open" });
    expect(P.core.takeOpen()).toMatchObject({ uid: "ua", free: 2 });
    P.core.openPosted(5);
    expect(P.core.takeLapsedOpen()).toBeNull();
  });

  it("10: a plan that takes the leader's copy back floors needs their confirm; the view names who goes back, by member, and the lives left", () => {
    const P = party();
    const lead = P.join("ua", "Ann");
    const bo = P.join("ub", "Bo");
    P.core.setTowerPlan({ key: "ua,ub", plan: { kind: "continue", floor: 5, back: [{ uid: "ua", floor: 30 }], lives: 1 } });
    // (With the climb's lives left: Nov 20.)
    expect(P.core.view(bo).tower!.plan).toEqual({ kind: "continue", floor: 5, back: [{ id: lead, floor: 30 }], lives: 1 });
    P.core.message(bo, { t: "ready", on: true });
    P.core.message(lead, { t: "start" });
    expect(P.core.takeStart()).toBeNull();
    P.core.message(lead, { t: "start", confirm: true });
    expect(P.core.takeStart()).not.toBeNull();
  });
});

describe("the clerk's list of open parties (Eric, Nov 20: \"click on the clerk and see the parties and like which ones you could join\")", () => {
  function party() {
    let now = T0;
    const core = new PartyCore(newPartyRecord("TOWER", now, "tower"), { now: () => now, send: () => undefined, random: () => "r" });
    const join = (uid: string, name: string) => (core.connect(undefined, { name, device: "phone", v: SQUADS_PROTOCOL, userId: uid }) as { memberId: string }).memberId;
    return { core, join, tick: (ms: number) => (now += ms) };
  }

  it("listed only while its line stands and it can take someone new: not before it's up, not full, not a run's own members climbing on", () => {
    const P = party();
    const lead = P.join("ua", "Ann");
    expect(P.core.towerListing()).toBeNull();
    P.core.message(lead, { t: "open" });
    expect(P.core.towerListing()).toBeNull();
    P.core.openPosted(3);
    expect(P.core.towerListing()).toEqual({ leader: "Ann", members: 1, max: TOWER_PARTY.max });
    P.join("ub", "Bo");
    expect(P.core.towerListing()).toEqual({ leader: "Ann", members: 2, max: TOWER_PARTY.max });
    // (Ann and Bo turn out to be a run's own members: their climb on together. Nobody new is looked for: the line lapses, the party is
    // closed to the town and Open party refused.)
    P.core.setTowerPlan({ key: "ua,ub", plan: { kind: "continue", floor: 4, back: [] } });
    expect(P.core.towerListing()).toBeNull();
    expect(P.core.takeLapsedOpen()).toEqual({ line: 3, room: "town" });
    expect(P.core.view(lead).tower).toMatchObject({ open: false, closed: true });
    P.core.message(lead, { t: "open" });
    expect(P.core.takeOpen()).toBeNull();
    // (A new climb's plan again: open to newcomers.)
    P.core.setTowerPlan({ key: "ua,ub", plan: { kind: "new", ends: [] } });
    P.core.message(lead, { t: "open" });
    expect(P.core.takeOpen()).toMatchObject({ uid: "ua", free: 2 });
    P.core.openPosted(4);
    P.join("uc", "Cy");
    P.join("ud", "Di");
    expect(P.core.towerListing()).toBeNull();
  });

  it("the town's open parties, newest first, each once, only while their lines stand", () => {
    const t = new TownChat();
    t.partyOpen("ua", "Ann is looking for 3 more", "AAAAA", T0);
    t.partyOpen("ub", "Bo is looking for 3 more", "BBBBB", T0 + 1000);
    t.post({ id: "uz", name: "Zed" }, "hello", T0 + 1500);
    // (A code held twice, a failed removal then the new leader's line: listed once, where its newest line is.)
    t.partyOpen("uc", "Cy is looking for 2 more", "AAAAA", T0 + 1600);
    expect(partyCodesOf(t.snapshot(T0 + 2000))).toEqual(["AAAAA", "BBBBB"]);
    t.removeParty(1, "AAAAA", T0 + 3000);
    t.removeParty(4, "AAAAA", T0 + 3000);
    expect(partyCodesOf(t.snapshot(T0 + 3000))).toEqual(["BBBBB"]);
    expect(partyCodesOf(t.snapshot(T0 + 1000 + TOWN_CHAT.lineMs))).toEqual([]);
  });

  it("the clerk's list is made once per Worker instance every TOWER_PARTY.listCacheMs, from its copy of the town's room, and shared by every reader (the delta review of #835, finding 1)", async () => {
    forgetTownCache();
    const t = new TownChat();
    // (More lines than the list holds, the newest few from parties that can't take anyone now: they don't push the others off.)
    const all = Array.from({ length: TOWER_PARTY.listMax + 4 }, (_, i) => `P${String.fromCharCode(65 + i)}AAA`);
    all.forEach((code, i) => t.partyOpen(`u${i}`, `Player ${i} is looking for 3 more`, code, T0 + i));
    const full = new Set(all.slice(-3));
    let reads = 0;
    const asked: string[] = [];
    const hub = { townRead: async () => (reads++, t.snapshot(T0 + 100)) };
    const listing = async (code: string) => (asked.push(code), full.has(code) ? null : { leader: code, members: 1, max: TOWER_PARTY.max });
    // (Many readers at once, and again within the time: one read of the room, each party asked once.)
    const lists = await Promise.all(Array.from({ length: 20 }, (_, i) => townOpenParties(hub, listing, T0 + 100 + i)));
    await townOpenParties(hub, listing, T0 + 100 + TOWER_PARTY.listCacheMs);
    expect(reads).toBe(1);
    expect(asked).toHaveLength(all.length);
    expect(new Set(asked).size).toBe(all.length);
    const want = all.filter((c) => !full.has(c)).reverse().slice(0, TOWER_PARTY.listMax);
    for (const l of lists) expect(l.map((p) => p.code)).toEqual(want);
    // (Once the time is up, the next reader's list is made afresh: the room's copy (TOWN_CHAT.readCacheMs) read again, the parties asked again.)
    await townOpenParties(hub, listing, T0 + 101 + TOWER_PARTY.listCacheMs + TOWN_CHAT.readCacheMs);
    expect(reads).toBe(2);
    expect(asked).toHaveLength(2 * all.length);
    // (Its own room each: a test's room is never the town's list.)
    await townOpenParties(hub, listing, T0 + 102 + TOWER_PARTY.listCacheMs + TOWN_CHAT.readCacheMs, undefined, "test:x");
    expect(reads).toBe(3);
    forgetTownCache();
  });
});

describe("the town's party line (town-chat.ts, the review of #835, findings 2 and 4)", () => {
  it("one line an account (a newer replaces the older), a new one at most every TOWER_PARTY.openGapMs; a party takes out only its own line", () => {
    const t = new TownChat();
    const a = t.partyOpen("ua", "Ann is looking for 3 more to climb the Battle Tower", "AAAAA", T0);
    expect(a.ok).toBe(true);
    const n = (a as { line: { n: number } }).line.n;
    expect(t.partyOpen("ua", "Ann is looking for 3 more", "BBBBB", T0 + 1000)).toEqual({ ok: false, retryMs: TOWER_PARTY.openGapMs - 1000 });
    const b = t.partyOpen("ua", "Ann is looking for 2 more", "BBBBB", T0 + TOWER_PARTY.openGapMs);
    expect(b.ok).toBe(true);
    const snap = t.snapshot(T0 + TOWER_PARTY.openGapMs);
    expect(snap.lines.filter((l) => l.sys === "party").map((l) => l.party)).toEqual(["BBBBB"]);
    // (Its leader's account behind it, never a name to tap: muting or blocking them hides it (the delta review's finding 8).)
    expect(snap.lines.filter((l) => l.sys === "party").map((l) => [l.from, l.name])).toEqual([["ua", ""]]);
    expect(snap.gone).toContain(n);
    // (Another account's line stands beside it.)
    expect(t.partyOpen("ub", "Bo is looking for 3 more", "CCCCC", T0 + TOWER_PARTY.openGapMs).ok).toBe(true);
    // (A party takes out only its own line: never a line of the same number that's another's, as after a restart.)
    const m = (b as { line: { n: number } }).line.n;
    expect(t.removeParty(m, "AAAAA", T0 + TOWER_PARTY.openGapMs + 1)).toBe(false);
    expect(t.removeParty(m, "BBBBB", T0 + TOWER_PARTY.openGapMs + 1)).toBe(true);
    const played = t.post({ id: "uz", name: "Zed" }, "hello", T0 + TOWER_PARTY.openGapMs + 2);
    expect(played.ok && t.removeParty(played.line.n, "CCCCC", T0 + TOWER_PARTY.openGapMs + 3)).toBe(false);
    expect(t.line(played.ok ? played.line.n : 0, T0 + TOWER_PARTY.openGapMs + 3)).not.toBeNull();
    // (A deleted account's party line goes with its other lines; everything is gone after its time.)
    expect(t.dropAccount("ub", T0 + TOWER_PARTY.openGapMs + 4, true)).toBe(true);
    expect(t.snapshot(T0 + TOWER_PARTY.openGapMs + 4).lines.some((l) => l.party === "CCCCC")).toBe(false);
    t.sweep(T0 + 2 * TOWER_PARTY.openGapMs + TOWN_CHAT.lineMs);
    expect(t.empty).toBe(true);
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

describe("the admin's 🏆 \"Win this match\" on a party floor (Nov 20; docs/decisions/2026-11-20-admin-win-match.md)", () => {
  it("a non-admin's win message is refused; the admin's: the party's next move wins the floor, every copy's end a win", () => {
    let now = 1_000_000;
    const inbox = new Map<string, ServerMessage[]>();
    const run = newRun(5, POOL);
    const overrides = JSON.parse(JSON.stringify(towerPartySettings(floorSettings(run))));
    const start = { id: 1, members: [0, 1].map((i) => ({ id: `m${i}`, seat: i, pass: `pass${i}`, userId: `u${i}` })), bots: 0, leaderSeat: 0, boss: "", difficulty: "normal" as const };
    const core = new LobbyCore(
      newLobbyRecord("FLOOR", now, overrides, partyLobby(start, "TOWER", now, { fight: "f1" })),
      { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), msg as ServerMessage]) },
      library,
      mulberry32(3),
      { ...DEFAULT_SETTINGS, ...overrides, boardIntroSeconds: 0 } as Settings,
    );
    const runner = () => (core as unknown as { runner: MatchRunner }).runner;
    const advance = (ms: number) => {
      const to = now + ms;
      while (core.nextAlarm !== null && core.nextAlarm <= to) {
        now = Math.max(now, core.nextAlarm);
        core.alarm();
      }
      now = to;
    };
    // (The host's device scores each turn: every move even, its bosses' replies the first legal move.)
    const hostScores = () => {
      const req = [...(inbox.get("p1") ?? [])].reverse().find((m) => m.t === "scoreRequest") as Extract<ServerMessage, { t: "scoreRequest" }> | undefined;
      if (!req) return;
      const boards: BoardScore[] = req.jobs.map((j) => {
        const legal = legalMoves(j.fen);
        return { boardId: j.boardId, bestMove: legal[0]!, bestExpected: 0.4, expectedAfter: Object.fromEntries(legal.map((m) => [m, 0.4])), botPicks: {}, botThinkMs: {} };
      });
      core.message("p1", { t: "scores", key: req.key, boards });
      inbox.set("p1", (inbox.get("p1") ?? []).filter((m) => m.t !== "scoreRequest"));
    };
    for (const seat of [0, 1]) expect(core.connect(undefined, `M${seat}`, "phone", false, 1500, undefined, `u${seat}`, null, null, false, { pass: `pass${seat}`, seat }).ok).toBe(true);
    advance(60_000);
    advance(60_000);
    expect(runner().boss).toBeTruthy();
    // (A player's press, as the Durable Object passes it (not an admin): refused; the message itself never arms it.)
    core.message("p2", { t: "winForm" });
    expect(core.winFormTrigger("p2", false)).toBe(false);
    expect(runner().bossForceWin).toBe(false);
    expect(core.record.winForm).toBeUndefined();
    // (The admin's seat.)
    expect(core.winFormTrigger("p1", true)).toBe(true);
    expect(core.record).toMatchObject({ winForm: true, overrides: { tested: true } });
    for (let i = 0; i < 40 && core.record.phase !== "results"; i++) {
      const key = core.record.round?.key;
      const fen = runner().boards.get(runner().state.boards[0]!)!.fen;
      if (key && runner().boss && !runner().boss!.result) {
        const move = legalMoves(fen)[0]!;
        core.message("p1", { t: "pick", key, move });
        core.message("p2", { t: "pick", key, move });
      }
      hostScores();
      advance(2000);
    }
    expect(runner().boss!.result).toBe("crowd");
    expect(runner().boss!.crowdMoves).toBe(1);
    expect(core.takeTowerEnds()).toEqual([
      { uid: "u0", outcome: "won" },
      { uid: "u1", outcome: "won" },
    ]);
  });
});
