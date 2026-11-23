import openings from "@chessroyale/chess/data/openings.json";
import type { Opening } from "@chessroyale/chess";
import { SQUADS_PROTOCOL, dutyOf, playsAsBot, squadsLegalMoves, type SquadsServerMessage } from "@chessroyale/chess/squads";
import { SquadsCore, newSquadsRecord, type SquadsIO, type SquadsRecord, type SquadsServerRequest } from "../src/squads-lobby.ts";

export const library = openings as unknown as Opening[];

type Msg = SquadsServerMessage;

/**
 * A Squads lobby on a fake clock, with an inbox per player (squads-lobby.ts, no Durable Object): `advance` runs every
 * alarm that falls due, as the Durable Object would.
 */
export function squadsLobby(opts: { seed?: number; test?: SquadsRecord["test"]; fillInMs?: number; serverEngine?: boolean } = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const closed: string[] = [];
  const server: SquadsServerRequest[] = [];
  const io: SquadsIO = {
    now: () => now,
    send: (id, m) => inbox.set(id, [...(inbox.get(id) ?? []), { ...m, now } as Msg]),
    close: (id) => void closed.push(id),
    serverEngine: !!opts.serverEngine,
    serverTop: (r) => void server.push(r),
  };
  const record = newSquadsRecord("SQUAD", now, opts.seed ?? 7, { auto: !opts.test, fillAt: now + (opts.fillInMs ?? 60_000), test: opts.test });
  const core = new SquadsCore(record, {}, io, library);
  const join = (name: string, extra: { party?: string; test?: boolean; userId?: string; device?: "phone" | "computer" } = {}) => {
    const r = core.connect(undefined, { name, v: SQUADS_PROTOCOL, ...extra });
    if (!r.ok) throw new Error(r.message);
    return r.playerId;
  };
  /** People who play their own duties: the first legal move their partner hasn't taken, at once. */
  const players = new Set<string>();
  const act = () => {
    for (const id of players) {
      for (const lm of core.allMatches()) {
        const half = lm.half;
        if (lm.state !== "half" || !half || half.inputs.locked[id]) continue;
        const d = dutyOf(lm.m, id);
        const seat = core.record.squads.flatMap((sq) => sq.players).find((p) => p.id === id);
        if (!d || !seat || playsAsBot(seat)) continue;
        const taken = d.partner ? half.inputs.choices[d.partner] : undefined;
        const move = squadsLegalMoves(lm.m.boards[d.duty.board]!.fen).find((m) => m !== taken);
        if (!move) continue;
        core.message(id, { t: "choose", key: lm.key, seq: half.seq, move });
        core.message(id, { t: "lock", key: lm.key, seq: half.seq });
      }
    }
  };
  const tick = (t: number) => {
    now = Math.max(now, t);
    core.alarm();
    act();
  };
  /** Runs every alarm due by `t` (and moves the clock there). */
  const advanceTo = (t: number) => {
    for (let guard = 0; guard < 200_000; guard++) {
      const next = core.nextAlarm;
      if (next === null || next > t) break;
      tick(next);
    }
    now = Math.max(now, t);
  };
  const advance = (ms: number) => advanceTo(now + ms);
  /** Runs alarms until `done` holds (within `maxMs` of lobby time). */
  const runUntil = (done: () => boolean, maxMs = 3 * 3_600_000, what = "the condition") => {
    const end = now + maxMs;
    for (let guard = 0; !done() && guard < 400_000; guard++) {
      const next = core.nextAlarm;
      if (next === null || next > end) throw new Error(`stuck before ${what} (next alarm ${next === null ? "none" : next - now} ms away)`);
      tick(next);
    }
    if (!done()) throw new Error(`never reached ${what}`);
  };
  const msgs = (id: string) => inbox.get(id) ?? [];
  const last = <T extends Msg["t"]>(id: string, t: T) => [...msgs(id)].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const all = <T extends Msg["t"]>(id: string, t: T) => msgs(id).filter((m) => m.t === t) as Extract<Msg, { t: T }>[];
  const clear = (id?: string) => (id ? inbox.set(id, []) : inbox.clear());
  return {
    core,
    io,
    join,
    players,
    advance,
    advanceTo,
    runUntil,
    last,
    all,
    clear,
    inbox,
    closed,
    server,
    get now() {
      return now;
    },
    set now(t: number) {
      now = t;
    },
  };
}
