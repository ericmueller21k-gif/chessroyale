import { describe, expect, it } from "vitest";
import { HIDDEN_ROOM, RECLUSE_FORMS } from "@chessroyale/core";
import { soloFormsBeaten } from "../src/public-profile.ts";

// App.tsx's soloResult stores his forms beaten as `soloFormsBeaten(mode, runner.boss, teamWon, phase.simul)`: these are its cases, each
// with the runner's boss and the result as a Boss alone fight against him ends (the review of #990, nit 3).
const count = soloFormsBeaten;

describe("soloResult's count of his forms beaten (App.tsx; results.forms_beaten)", () => {
  const him = HIDDEN_ROOM.boss;
  it("each way a Boss alone fight against him ends", () => {
    expect(RECLUSE_FORMS).toEqual(["child", "adult", "four"]);
    // A resign or a loss as the child: none.
    expect(count("boss", { id: him, form: "child" }, false)).toBe(0);
    expect(count("boss", { id: him, form: "child", result: "boss" }, false)).toBe(0);
    // Lost to his adult form (a resign, his mate, the clock): the child.
    expect(count("boss", { id: him, result: "boss" }, false)).toBe(1);
    expect(count("boss", { id: him }, null)).toBe(1);
    // Lost on the four boards (phase 2: `simul`; the runner's boss is the man, fallen): the child and the man, never one or three.
    expect(count("boss", { id: him, result: "crowd" }, false, { won: 2, of: 4 })).toBe(2);
    expect(count("boss", { id: him, result: "crowd" }, null, { won: 0, of: 4 })).toBe(2);
    // The man fallen with no four boards after (his result the crowd's), not seen through: the child and the man.
    expect(count("boss", { id: him, result: "crowd" }, null)).toBe(2);
    // Won: all three.
    expect(count("boss", { id: him, result: "crowd" }, true, { won: 4, of: 4 })).toBe(3);
  });

  it("nothing for another boss, a solo Crowd or Classic", () => {
    expect(count("boss", { id: "gingerbread", result: "crowd" }, true)).toBeNull();
    expect(count("crowd", { id: him, result: "crowd" }, true, { won: 4, of: 4 })).toBeNull();
    expect(count("classic", null, null)).toBeNull();
  });
});
