import { describe, expect, it } from "vitest";
import { brilliance } from "../src/scoring.ts";

const pick = (id: string, move: string, loss: number, usedPowerUp = false) => ({ playerId: id, move, loss, usedPowerUp });

describe("brilliant moves", () => {
  it("a move few found that left the rest well behind", () => {
    const players = [pick("a", "Nxf7", 0), pick("b", "Nxf7", 0.5), ...Array.from({ length: 18 }, (_, i) => pick(`p${i}`, "h3", 14))];
    const b = brilliance(players)!;
    expect(b.moves).toEqual(["Nxf7"]);
    expect(b.players).toEqual(["a", "b"]);
    expect(b.found).toBe(2);
    expect(b.total).toBe(20);
  });

  it("never for a pick made with a power-up (it showed the engine's moves)", () => {
    const players = [pick("a", "Nxf7", 0, true), pick("b", "Nxf7", 0), ...Array.from({ length: 18 }, (_, i) => pick(`p${i}`, "h3", 14))];
    expect(brilliance(players)!.players).toEqual(["b"]);
  });

  it("not when most found it, or when the others were barely worse", () => {
    const many = [...Array.from({ length: 10 }, (_, i) => pick(`g${i}`, "e4", 0)), ...Array.from({ length: 10 }, (_, i) => pick(`p${i}`, "h3", 14))];
    expect(brilliance(many)).toBeNull();
    const close = [pick("a", "e4", 0), ...Array.from({ length: 19 }, (_, i) => pick(`p${i}`, "d4", 3))];
    expect(brilliance(close)).toBeNull();
  });

  it("not in a small group", () => {
    expect(brilliance([pick("a", "Nxf7", 0), pick("b", "h3", 20), pick("c", "h3", 20)])).toBeNull();
  });
});
