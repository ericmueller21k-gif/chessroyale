/**
 * How big a lobby's stored record gets (the Durable Object writes it after every message): a Crowd lobby with N
 * people, played for a while with a fake host, then the record's size, field by field.
 *
 *   npx tsx scripts/load/record-size.ts [people=100] [seconds=240]
 */
import { CROWD_SETTINGS, DEFAULT_SETTINGS, modeSettings, mulberry32 } from "../../packages/core/src/index.ts";
import { legalMoves, type BoardScore, type Opening, type ServerMessage } from "../../packages/chess/src/index.ts";
import openings from "../../packages/chess/data/openings.json" with { type: "json" };
import { LobbyCore, newLobbyRecord } from "../../packages/server/src/lobby.ts";

const people = Number(process.argv[2] ?? 100);
const seconds = Number(process.argv[3] ?? 240);
let now = 1_000_000;
const inbox = new Map<string, ServerMessage[]>();
const overrides = modeSettings("crowd", { crowdTeams: true, augments: true });
const rec = newLobbyRecord("ABCDE", now, overrides);
const io = { now: () => now, send: (id: string, msg: unknown) => inbox.set(id, [...(inbox.get(id) ?? []).slice(-20), msg as ServerMessage]), icon: () => undefined };
let core = new LobbyCore(rec, io, openings as unknown as Opening[], mulberry32(3));
core.setAuto(now + 60_000);
const look = { head: { item: "beanie", color: "#c33", purity: 70 }, face: { item: "ski-goggles", color: "#333", purity: 80 } };
for (let i = 0; i < people; i++) core.connect(undefined, `Player ${i}`, "computer", false, 1500, look, `user${i}`);
const ids = core.save().humans.map((h) => h.id);
const sizes: number[] = [];
const splitSizes: number[] = [];
let lastStored = new Map<string, unknown>();
const v8 = await import("node:v8");
const v8Sizes: number[] = [];
let saves = 0;
const save = () => {
  const r = core.save();
  saves++;
  sizes.push(JSON.stringify(r).length);
  // As lobby-do.ts stores it: the record without `last`, plus only the last messages that changed.
  const { last, ...rest } = r;
  v8Sizes.push(v8.serialize(r).length);
  const entries = Object.entries(last);
  const changed = entries.length !== lastStored.size || entries.some(([id, msg]) => lastStored.get(id) !== msg);
  splitSizes.push(v8.serialize(changed ? { rest, last } : { rest }).length);
  if (changed) lastStored = new Map(entries);
  // Each message, the Durable Object rebuilds the core from the stored record.
  core = new LobbyCore(r, io, openings as unknown as Opening[], mulberry32(saves));
};
for (let t = 0; t < seconds * 4; t++) {
  now += 250;
  if (core.nextAlarm && core.nextAlarm <= now) {
    core.alarm();
    save();
  }
  for (const id of ids) {
    const msgs = inbox.get(id) ?? [];
    inbox.set(id, []);
    for (const m of msgs) {
      if (m.t === "round" && m.alive && !m.watching && m.board) {
        const legal = legalMoves(m.board.fen);
        core.message(id, { t: "pick", key: m.key, move: legal[0]! });
        save();
      } else if (m.t === "vote" && m.vote.result === null) {
        core.message(id, { t: "vote", key: m.vote.key, option: 0 });
        save();
      } else if (m.t === "scoreRequest") {
        const boards: BoardScore[] = m.jobs.map((j) => {
          const legal = legalMoves(j.fen);
          const exp = Object.fromEntries(legal.map((x, i) => [x, 0.3 + (i % 7) / 30]));
          return { boardId: j.boardId, bestMove: legal[0]!, bestExpected: exp[legal[0]!]!, expectedAfter: exp, botPicks: Object.fromEntries(j.bots.map((b) => [b.id, legal[0]!])), botThinkMs: Object.fromEntries(j.bots.map((b) => [b.id, 4000])) };
        });
        core.message(id, { t: "scores", key: m.key, boards });
        save();
      }
    }
  }
}
const r = core.save() as unknown as Record<string, unknown>;
const total = JSON.stringify(r).length;
const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
console.log(`${people} people, ${seconds} s of match (phase ${String(r.phase)}): ${saves} saves, record now ${kb(total)}, largest ${kb(Math.max(...sizes))}, mean ${kb(sizes.reduce((a, b) => a + b, 0) / sizes.length)}`);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.log(`stored per message (V8 bytes, what storage.put writes): the whole record ${kb(mean(v8Sizes))} on average, median ${kb([...v8Sizes].sort((a, b) => a - b)[v8Sizes.length >> 1]!)}; with "last" apart (lobby-do.ts) ${kb(mean(splitSizes))} on average, median ${kb([...splitSizes].sort((a, b) => a - b)[splitSizes.length >> 1]!)}. (As JSON the record reads ${kb(mean(sizes))}: JSON repeats the standings every message shares.)`);
for (const [k, v] of Object.entries(r).map(([k, v]) => [k, JSON.stringify(v ?? null).length] as const).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`  ${k}: ${kb(v)} (${((100 * v) / total).toFixed(0)}%)`);
}
void CROWD_SETTINGS;
void DEFAULT_SETTINGS;
// What a Durable Object actually stores: V8's serialisation, which keeps an object shared between messages once.
console.log(`V8-serialised (what storage.put writes): whole record ${kb(v8.serialize(r).length)}, last ${kb(v8.serialize(r.last).length)}, the rest ${kb(v8.serialize({ ...r, last: {} }).length)}`);
