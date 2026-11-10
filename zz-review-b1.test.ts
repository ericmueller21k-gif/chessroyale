// Review of PR #601 (not part of the PR): proofs for review.md.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRONT_DOOR, JUDGES, SQUADS, SQUADS_LOBBY, voteResultMs } from "@chessroyale/core";
import { SQUADS_PROTOCOL, squadsLegalMoves, squadsVotes } from "@chessroyale/chess/squads";
import { clearTopCache } from "../src/squads-lobby.ts";
import { fallbackTop } from "../src/squads-bots.ts";
import { drawJudges } from "../src/judges.ts";
import { squadsLobby } from "./squads-fixture.ts";

const VOTES_MS = FRONT_DOOR.fillShowMs + SQUADS.firstVoteDelaySeconds * 1000 + squadsVotes().length * (SQUADS.voteSeconds * 1000 + voteResultMs(SQUADS));
function firstTurn(server = false) {
  const L = squadsLobby({ test: { start: 0 }, fillInMs: 5_000, serverEngine: server });
  const ids = [L.join("D0", { device: "computer" }), L.join("D1", { device: "computer" })];
  ids.forEach((id) => L.core.message(id, { t: "speed", nps: 1_000_000 }));
  L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
  const lead = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).find((j) => j.devices.length === 2 && !j.how)!;
  return { L, ids, lead };
}

describe("review b1", () => {
  beforeEach(() => clearTopCache());
  afterEach(() => clearTopCache());

  it("Squads: two devices (two solo parties) that disagree on purpose choose every move the server scores, and that verdict is shared", () => {
    const C = firstTurn(true);
    const real = fallbackTop(C.lead.fen, SQUADS.bots.candidates).map((m) => m.move);
    const junk = squadsLegalMoves(C.lead.fen).filter((m) => !real.includes(m));
    const a = junk.slice(0, 4).map((move, i) => ({ move, expected: 0.6 - i * 0.01 }));
    const b = junk.slice(4, 8).map((move, i) => ({ move, expected: 0.55 - i * 0.01 }));
    C.L.core.message(C.ids[0]!, { t: "botTop", id: C.lead.id, top: a });
    C.L.core.message(C.ids[1]!, { t: "botTop", id: C.lead.id, top: b });
    const req = C.L.server.find((r) => r.id === C.lead.id)!;
    // The server is asked to score only the devices' moves: none of the engine's real top moves.
    expect(req.moves.some((m) => real.includes(m))).toBe(false);
    // An honest server scores what it was asked (low numbers) ...
    C.L.core.serverAnswered(C.lead.id, req.moves.map((move, i) => ({ move, expected: 0.3 - i * 0.01 })));
    expect(C.lead.how).toBe("server");
    // ... and another lobby's bots now play from that list, asking no device.
    const D = firstTurn();
    const hit = D.L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).find((j) => j.fen === C.lead.fen && j.how === "cached");
    expect(hit).toBeDefined();
    expect(hit!.top!.every((m) => !real.includes(m.move))).toBe(true);
  });

  it("Squads: a party of four with bots: every bot job goes to one device, whose answer stands alone", () => {
    const L = squadsLobby({ test: { start: 0 }, fillInMs: 5_000 });
    L.core.reserve([{ size: 4, pass: "PASS" }], 60_000);
    const party = [0, 1, 2, 3].map((i) => L.join(`M${i}`, { party: "PASS", device: "computer" }));
    for (const id of party) L.core.message(id, { t: "speed", nps: 1_000_000 });
    L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
    const jobs = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).filter((j) => j.devices.length);
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.devices.length === 1)).toBe(true);
  });

  it("judges: share of mixed computer/phone pairs, cube vs linear (20 computers at 2M, 80 phones at 300k)", () => {
    const devices = [...Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, nps: 2_000_000 })), ...Array.from({ length: 80 }, (_, i) => ({ id: `p${i}`, nps: 300_000 }))];
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const share = (w: number) => {
      let mixed = 0, phones = 0;
      for (let i = 0; i < 4000; i++) {
        const j = drawJudges(rng, devices, 2, { speedWeight: w });
        const n = j.filter((x) => x.startsWith("p")).length;
        if (n === 1) mixed++;
        if (n === 2) phones++;
      }
      return { mixed: mixed / 4000, phones: phones / 4000 };
    };
    const cube = share(3), lin = share(JUDGES.speedWeight);
    console.log("REVIEW judge pairs", JSON.stringify({ cube, linear: lin }));
    expect(lin.mixed).toBeGreaterThan(cube.mixed * 5);
  });
});
