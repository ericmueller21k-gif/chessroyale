import { expect } from "@playwright/test";
import { test } from "./helpers.ts";
import { PartyClient, SquadsClient, guestCookie } from "./squads-client.ts";

/**
 * Squads through the real server (wrangler dev), headless: real sockets to the real matchmaker, party and lobby
 * objects (docs/areas/squads.md, "The server"). No screens yet (phase 3), so these talk the protocol directly, as the
 * screens will. Once per run (the server doesn't care which browser).
 */

const run = Date.now().toString(36).slice(-5);

test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "server only: once per run"));

test("a party of two: one code, the leader queues, both sit in one squad; bots fill the lobby after the queue's wait", async ({ baseURL }) => {
  test.setTimeout(120_000);
  const base = baseURL!;
  const [c1, c2] = await Promise.all([guestCookie(base), guestCookie(base)]);
  const res = await fetch(`${base}/api/squads/party?pool=party-${run}`, { method: "POST", headers: { cookie: c1 ?? "" } });
  expect(res.status).toBe(200);
  const { code } = (await res.json()) as { code: string };
  expect((await (await fetch(`${base}/api/squads/party/${code}`)).json()) as object).toMatchObject({ open: true, members: 0, state: "open" });
  const ann = new PartyClient(base, "Ann", c1);
  const bo = new PartyClient(base, "Bo", c2);
  await ann.join(code);
  await bo.join(code);
  await expect.poll(() => ann.party?.members.length).toBe(2);
  expect(ann.party!.leaderId).toBe(ann.memberId);
  // Only the leader queues.
  bo.send({ t: "queue" });
  ann.send({ t: "queue" });
  await expect.poll(() => bo.party?.placed?.lobby, { timeout: 20_000 }).toMatch(/^[A-Z2-9]{5}$/);
  const { lobby, pass } = bo.party!.placed!;
  const a = new SquadsClient({ base, name: "Ann", cookie: c1 });
  const b = new SquadsClient({ base, name: "Bo", cookie: c2 });
  await a.join(lobby, pass);
  await b.join(lobby, pass);
  expect(a.lobby!.phase).toBe("waiting");
  // MATCH_FILL_SECONDS (8 s here): bots take the other 30 seats; the party is one squad.
  await a.until(() => a.lobby?.phase !== "waiting", 30_000, "the fill");
  const squads = a.lobby!.squads;
  expect(squads).toHaveLength(8);
  const squadOf = (id: string) => squads.find((sq) => sq.seats.includes(id))!.id;
  expect(squadOf(a.playerId!)).toBe(squadOf(b.playerId!));
  expect(a.lobby!.players.filter((p) => p.isBot)).toHaveLength(30);
  // The votes come next, for everyone.
  await a.until(() => a.lobby?.phase === "vote", 15_000, "the votes");
  // Status for an old link or a reopened tab, as for Crowd's lobbies.
  expect((await (await fetch(`${base}/api/squads/lobby/${lobby}`)).json()) as object).toMatchObject({ open: true, phase: "vote" });
  expect((await fetch(`${base}/api/squads/lobby/ZZZZZ`)).status).toBe(404);
  // Leaving now: a bot takes the seat at once, and the socket closes.
  b.send({ t: "leave" });
  await expect.poll(() => b.closed).toBe(true);
  await a.until(() => !!a.lobby?.players.find((p) => p.id === b.playerId)?.left, 10_000, "Bo gone");
  for (const c of [a, b]) c.close();
  ann.close();
  bo.close();
});

test("a test lobby straight at the final (SQUADS_TEST): its people play; Next round ends it; no rewards", async ({ baseURL }) => {
  test.setTimeout(180_000);
  const base = baseURL!;
  const cookie = await guestCookie(base);
  const res = await fetch(`${base}/api/squads/lobby?start=final&keep=30`, { method: "POST", headers: { cookie: cookie ?? "" } });
  expect(res.status).toBe(200);
  const { code } = (await res.json()) as { code: string };
  const tess = new SquadsClient({ base, name: "Tess", cookie, play: true, thinkMs: [300, 800] });
  await tess.join(code);
  expect(tess.test).toBe(true);
  // It fills with bots a few seconds after it opens, votes, then only the final is played.
  await tess.until(() => tess.lobby?.phase === "bracket", 60_000, "the bracket");
  expect(tess.lobby!.bracket.filter((m) => m.round < 2).every((m) => m.state === "over")).toBe(true);
  await tess.until(() => tess.matches.get("r2m0")?.state === "half", 30_000, "the final's first half");
  const fin = tess.matches.get("r2m0")!;
  expect(fin.sides.some((s) => s.seats.includes(tess.playerId!))).toBe(true);
  // A few halves played (picks, blocks, the reveal), then the test control.
  await tess.until(() => (tess.matches.get("r2m0")?.boards[0]?.ply ?? 0) >= 4, 120_000, "four moves in the final");
  tess.send({ t: "nextRound" });
  await tess.until(() => tess.lobby?.phase === "results", 15_000, "the results");
  expect(tess.results).not.toBeNull();
  expect(tess.placed).toMatchObject({ coins: 0, crates: 0, recorded: false });
  tess.close();
});
