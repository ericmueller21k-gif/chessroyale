import { describe, expect, it } from "vitest";
import { modeSettings, JUDGES } from "@chessroyale/core";
import { setup } from "./lobby-fixture.ts";

describe("review: one account, many seats", () => {
  it("the same account takes several seats in one Crowd lobby, and its tabs are drawn as both judges", () => {
    const L = setup({ ...modeSettings("crowd", { augments: true }) });
    const a = L.core.connect(undefined, "Mallory", "computer", false, 1500, undefined, "user-1");
    const b = L.core.connect(undefined, "Mallory", "computer", false, 1500, undefined, "user-1");
    const c = L.core.connect(undefined, "Mallory", "computer", false, 1500, undefined, "user-1");
    const honest = L.core.connect(undefined, "Honest", "phone", false, 1500, undefined, "user-2");
    console.log(JSON.stringify({ a, b, c, honest, seats: L.core.record.humans.map((h) => h.id), accounts: L.core.record.accounts }));
    expect([a, b, c].every((r) => r.ok)).toBe(true);
    // each tab claims the top speed; the honest phone a real one
    for (const id of ["p1", "p2", "p3"]) L.core.message(id, { t: "speed", nps: 50_000_000 } as never);
    L.core.message("p4", { t: "speed", nps: 300_000 } as never);
    console.log(JSON.stringify({ devices: L.core.record.judges?.devices, judgesOn: JUDGES.on, perJob: JUDGES.perJob }));
  });
});
