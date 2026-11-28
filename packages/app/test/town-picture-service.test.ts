import { describe, expect, it } from "vitest";
import { PIC_GROUP, PictureService } from "../src/town/picture-service.ts";

/**
 * The town's picture service (Nov 28, the town's structure, phase 2; docs/decisions/2026-11-28-town-picture-service.md): the one door
 * for the pictures the device makes. Asking makes and uploads nothing; a slice between frames (`pump`) does, within its budget; a
 * picture is drawn only once the GPU holds it; one asked again with a new stamp goes on being drawn until its new picture is ready;
 * when a group's pages are full the picture least lately asked for makes room, never one in use or one held; no room: it waits.
 * (Until phase 2 the name tags had a cache of their own, tags.ts `TagCache`, with the same rules: its three checks are the first
 * three below, on the service.)
 */
type Cv = { id: string; width: number };
const cv = (id: string): Cv => ({ id, width: 8 });
const src = (c: Cv) => c as unknown as CanvasImageSource;

/** A painter that holds up to `room[group]` pictures a group, uploading only in `kept`. */
function painter(room: number[] = [99, 99, 99]) {
  const queue: [Cv, number][] = [];
  const held = new Map<Cv, number>();
  const p = {
    lost: false,
    uploads: 0,
    freed: [] as string[],
    keeps: [] as string[],
    keep(c: CanvasImageSource, group = 0) {
      const x = c as unknown as Cv;
      p.keeps.push(x.id);
      queue.push([x, group]);
    },
    kept() {
      for (const [c, g] of queue.splice(0)) {
        if ([...held.values()].filter((x) => x === g).length >= room[g]!) continue;
        held.set(c, g);
        p.uploads++;
      }
      return 1;
    },
    holds: (c: CanvasImageSource) => held.has(c as unknown as Cv),
    free(c: CanvasImageSource) {
      const x = c as unknown as Cv;
      p.freed.push(x.id);
      held.delete(x);
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i]![0] === x) queue.splice(i, 1);
    },
    held: () => [...held.keys()].map((c) => c.id).sort(),
  };
  return p;
}
const T = PIC_GROUP.text;
const L = PIC_GROUP.looks;

describe("the picture service: asked ahead, made and uploaded between frames, drawn when ready", () => {
  it("holds one picture per key: a sidekick's blue tag, a pawn's white and yours gold are three of the same name; another name or size is another picture", () => {
    const p = painter();
    const s = new PictureService(p);
    const made: string[] = [];
    const ask = (key: string) => s.ask(T, key, 0, () => (made.push(key), { cv: src(cv(key)) }));
    for (const k of ["tag|bot|12|Squirt", "tag|sidekick|12|Squirt", "tag|you|12|Squirt", "tag|bot|9|Squirt", "tag|bot|12|Tex"]) expect(ask(k), "nothing is ready as it's asked").toBeNull();
    expect(made, "and nothing is made by asking").toEqual([]);
    s.pump(1e9);
    expect(made.length).toBe(5);
    expect(p.held().length).toBe(5);
    // Asked again: the same picture each, nothing made again.
    const a = ask("tag|bot|12|Squirt");
    expect(a).not.toBeNull();
    expect(ask("tag|bot|12|Squirt")).toBe(a);
    expect(ask("tag|sidekick|12|Squirt")).not.toBe(a);
    expect(made.length).toBe(5);
    expect(s.stats().ready[T]).toBe(5);
  });

  it("when its group is full, lets go of the picture least lately asked for, never one asked for in this frame or the last, and makes it again if it's asked for again", () => {
    const p = painter([99, 3, 99]);
    const s = new PictureService(p);
    const ask = (key: string) => s.ask(T, key, 0, () => ({ cv: src(cv(key)) }));
    for (const k of ["A", "B", "C"]) ask(k);
    s.pump(1e9);
    expect(p.held()).toEqual(["A", "B", "C"]);
    // Frames go by: A and C are drawn in each, B in none.
    for (let i = 0; i < 5; i++) (s.tick(), ask("A"), ask("C"));
    ask("D");
    s.pump(1e9);
    s.pump(1e9);
    expect(p.held(), "B, the least lately asked for, made room for D").toEqual(["A", "C", "D"]);
    expect(s.evicted).toBe(1);
    expect(ask("B"), "B is gone: asked for again, it's made again").toBeNull();
    // Full, and everything was asked for in this frame: nothing goes, B waits.
    s.pump(1e9);
    s.pump(1e9);
    expect(p.held()).toEqual(["A", "C", "D"]);
    expect(s.stats().stuck, "B waits for room").toBe(1);
    expect(ask("A"), "the ones in use are all still here").not.toBeNull();
    expect(ask("D")).not.toBeNull();
  });

  it("keeps a group's other pictures, and every other group's, when one is let go; one held is never let go", () => {
    const p = painter([99, 2, 1]);
    const s = new PictureService(p);
    s.ask(T, "name", 0, () => ({ cv: src(cv("name")) }), true);
    s.ask(T, "old tag", 0, () => ({ cv: src(cv("old tag")) }));
    s.ask(L, "look", 0, () => ({ cv: src(cv("look")) }));
    s.pump(1e9);
    for (let i = 0; i < 3; i++) s.tick();
    s.ask(T, "new tag", 0, () => ({ cv: src(cv("new tag")) }));
    s.pump(1e9);
    s.pump(1e9);
    expect(p.held(), "the held name stays though it's the oldest; the looks' picture is another group's").toEqual(["look", "name", "new tag"]);
    // The looks' one place: the next look takes it from the one no longer drawn; the text keeps all of its own.
    s.ask(L, "look 2", 0, () => ({ cv: src(cv("look 2")) }));
    s.pump(1e9);
    s.pump(1e9);
    expect(p.held()).toEqual(["look 2", "name", "new tag"]);
  });

  it("makes within its budget, a slice at a time, a long job a step a call; uploads only in the pump, never as it's asked", () => {
    const p = painter();
    let now = 0;
    const s = new PictureService(p, () => now);
    let steps = 0;
    const slow = (id: string) => () => ((now += 2), { cv: src(cv(id)) });
    for (const k of ["a", "b", "c", "d"]) s.ask(T, k, 0, slow(k));
    s.ask(L, "statue", 0, () => ((now += 2), ++steps < 3 ? null : { cv: src(cv("statue")) }));
    expect(p.uploads).toBe(0);
    expect(s.pump(3), "a 3 ms slice of 2 ms jobs: two made, more to do").toBe(true);
    expect(p.held()).toEqual(["a", "b"]);
    expect(s.busy).toBe(true);
    s.pump(3);
    expect(p.held()).toEqual(["a", "b", "c", "d"]);
    // The statue's three steps: a slice makes what fits, and it's ready only after the last.
    s.pump(3);
    expect(s.get("statue")).toBeNull();
    s.pump(3);
    expect(s.get("statue")).not.toBeNull();
    expect(steps).toBe(3);
    expect(s.busy).toBe(false);
    expect(s.waiting).toBe(0);
  });

  it("a new stamp (another pixel ratio, its font come) makes it again while the old picture is still drawn, then swaps and lets the old one go", () => {
    const p = painter();
    const s = new PictureService(p);
    let n = 0;
    const ask = (stamp: number) => s.ask(T, "tag", stamp, () => ({ cv: src(cv(`v${++n}`)), stamp }));
    ask(1);
    s.pump(1e9);
    const one = ask(1)!;
    expect(one.stamp).toBe(1);
    expect(ask(2), "the old one is drawn while the new one is on its way").toBe(one);
    expect(ask(2), "asked again meanwhile: not queued twice").toBe(one);
    s.pump(1e9);
    expect(ask(2)!.stamp).toBe(2);
    expect(n).toBe(2);
    expect(p.held()).toEqual(["v2"]);
    expect(p.freed).toEqual(["v1"]);
  });

  it("the loading screen: made without uploading, then ready once the painter's own loop has uploaded and `settle` is told", () => {
    const p = painter();
    const s = new PictureService(p);
    s.ask(T, "sign", 0, () => ({ cv: src(cv("sign")) }), true);
    s.ask(L, "ride", 0, () => ({ cvs: [src(cv("f1")), src(cv("f2"))] }));
    expect(s.pump(1e9, false), "nothing left to make").toBe(false);
    expect(p.uploads, "handed over, not uploaded").toBe(0);
    expect(s.get("sign")).toBeNull();
    p.kept();
    s.settle(true);
    expect(s.get("sign")).not.toBeNull();
    expect(s.get("ride"), "a picture of several is ready once all are on the GPU").not.toBeNull();
    expect(p.held()).toEqual(["f1", "f2", "sign"]);
  });

  it("two keys sharing one canvas hand it over once and free it with the last; dropping one on its way never makes it", () => {
    const p = painter();
    const s = new PictureService(p);
    const pawn = src(cv("pawn"));
    s.ask(L, "look 1", 0, () => ({ cvs: [pawn, src(cv("hat"))] }));
    s.ask(L, "look 2", 0, () => ({ cvs: [pawn] }));
    let made = false;
    s.ask(L, "never", 0, () => ((made = true), { cv: src(cv("never")) }));
    s.drop("never");
    s.pump(1e9);
    expect(made).toBe(false);
    expect(p.keeps.filter((k) => k === "pawn").length).toBe(1);
    s.drop("look 1");
    expect(p.held(), "the pawn stays for the look that still wears it").toEqual(["pawn"]);
    s.drop("look 2");
    expect(p.held()).toEqual([]);
  });

  it("with the context lost nothing is uploaded, counted ready or let go to make room: it all waits for the town to put it back", () => {
    const p = painter([99, 1, 99]);
    const s = new PictureService(p);
    s.ask(T, "A", 0, () => ({ cv: src(cv("A")) }));
    s.pump(1e9);
    for (let i = 0; i < 3; i++) s.tick();
    p.lost = true;
    s.ask(T, "B", 0, () => ({ cv: src(cv("B")) }));
    s.pump(1e9);
    expect(s.evicted).toBe(0);
    expect(s.get("A")).not.toBeNull();
    expect(s.get("B")).toBeNull();
    expect(s.busy).toBe(true);
  });
});
