import { describe, expect, it } from "vitest";
import { Press } from "../src/town/press.ts";

/** The town square's press (src/town/press.ts): a finger on the world as a button. */
describe("town square press", () => {
  it("down presses; up on the same thing walks", () => {
    const p = new Press(8);
    p.down(100, 200, "sq:3,4");
    expect(p.pressing()).toBe(true);
    expect(p.up("sq:3,4")).toBe("walk");
    expect(p.pressing()).toBe(false);
  });

  it("a drag past the threshold cancels the press and is a look-around drag", () => {
    const p = new Press(8);
    p.down(100, 200, "sq:3,4");
    expect(p.move(104, 203)).toBe(false); // (5 px: still a press)
    expect(p.pressing()).toBe(true);
    expect(p.move(112, 200)).toBe(true);
    expect(p.pressing()).toBe(false);
    expect(p.up("sq:3,4")).toBe("drag");
  });

  it("up over something else lets go without walking; nothing under the finger presses nothing", () => {
    const p = new Press(8);
    p.down(100, 200, "boss:tiger");
    expect(p.up("sq:9,9")).toBe("cancel");
    p.down(100, 200, "");
    expect(p.pressing()).toBe(false);
    expect(p.up("")).toBe("none");
    expect(p.up("sq:1,1")).toBe("none"); // (no finger down)
  });

  it("a cancelled pointer leaves nothing pressed", () => {
    const p = new Press(8);
    p.down(0, 0, "sq:1,1");
    p.cancel();
    expect(p.pressing()).toBe(false);
    expect(p.up("sq:1,1")).toBe("none");
  });
});
