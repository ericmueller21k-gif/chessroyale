import { describe, expect, it } from "vitest";
import { DEFAULT_PAWN_COLOR, PAWN_COLORS, cleanPawnColor, pawnColorOf, sideOfPawn } from "../src/pawn-color.ts";

describe("the default pawn color (Eric, Nov 7)", () => {
  it("two colors, white by default; only white or black is ever kept", () => {
    expect(PAWN_COLORS).toEqual(["white", "black"]);
    expect(DEFAULT_PAWN_COLOR).toBe("white");
    expect(cleanPawnColor("black")).toBe("black");
    expect(cleanPawnColor("white")).toBe("white");
    for (const junk of ["green", "Black", "", 0, 1, null, undefined, {}]) expect(cleanPawnColor(junk)).toBeNull();
  });

  it("what a stored value means: nothing or junk is white; the figure's side is w or b", () => {
    expect(pawnColorOf(null)).toBe("white");
    expect(pawnColorOf(undefined)).toBe("white");
    expect(pawnColorOf("nonsense")).toBe("white");
    expect(pawnColorOf("black")).toBe("black");
    expect(sideOfPawn("white")).toBe("w");
    expect(sideOfPawn("black")).toBe("b");
  });
});
