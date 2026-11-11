/**
 * Rolling Dough, Don Dough's bakery (Nov 11; docs/areas/town-square.md, "Inside a shop"): its two rooms and the door between them, the
 * talk spot at the back table, the guards' watch, the people's scene (the guards' lines, the chatter's loop, the talk beat), Don's intro
 * as data, the words and the room's sounds. Pure: the room (room.ts), the scene (zebra-scene.ts), the timeline (timeline.ts).
 */
import { describe, expect, it } from "vitest";
import { findPath, makeRoom, onPass, passArrive, tapTarget, inTalkRange, walkable } from "../src/town/shops/room.ts";
import { BACK_ROOMS, SHOPS, canChallengeInside } from "../src/town/shops/shops.ts";
import { SHOP_ZEBRA_BACK_FLOOR, SHOP_ZEBRA_BACK_LAYOUT, SHOP_ZEBRA_BACK_N, SHOP_ZEBRA_DOORS, SHOP_ZEBRA_BACK_DOORS, SHOP_ZEBRA_FLOOR, SHOP_ZEBRA_LAYOUT, SHOP_ZEBRA_PAD } from "../src/town/shops/zebra-art.ts";
import { NPC_ZEBRA_CREW_C, NPC_ZEBRA_CREW_D, NPC_ZEBRA_CREW_E, NPC_ZEBRA_GUARD_A, ZEBRA_AIM_ANGLES, ZEBRA_AIM_LOOP, ZEBRA_WATCH_FRAME } from "../src/town/shops/zebra-crew.ts";
import { BOSS_ZEBRA } from "../src/town/shops/zebra-don.ts";
import { BackScene, FrontScene, SetupScene, WalkOut, ZEBRA_BACK_SET, ZEBRA_BACK_SET_SQUARES, ZEBRA_CREW, ZEBRA_GUARDS, aimAt, doorAlpha, lineMs, watchFrame, type CarriedNow, type SceneClips, type SceneFig, type SetupItem } from "../src/town/shops/zebra-scene.ts";
import { ZEBRA_BACK_LINES, ZEBRA_BATTLE_START, ZEBRA_CHATTER, ZEBRA_GUARD_LINES, ZEBRA_OUTSIDE_LINES, ZEBRA_TALK, pickLine } from "../src/town/shops/zebra-lines.ts";
import { clipsOf, timelineAt, timelineBeats, timelineCues } from "../src/town/shops/timeline.ts";
import { INTRO_ZEBRA_FRONT, INTRO_ZEBRA_STORM } from "../src/town/shops/zebra-intro-art.ts";
import { ZEBRA_INTRO } from "../src/town/shops/intros/zebra.ts";
import { CHALLENGE_FEEL, introOf, marksFeel, marksOf, seatedMarks } from "../src/town/shops/challenge.ts";
import { ZEBRA_ROOM_SOUNDS, zebraSound } from "../src/characters/zebra-sounds.ts";
import { MOVE_PEAK } from "../src/characters/synth.ts";
import { SHOP_FEEL } from "../src/town/feel.ts";

const front = SHOPS.zebra!;
const back = BACK_ROOMS.zebra!;
const frontRoom = makeRoom(SHOP_ZEBRA_LAYOUT, front.keeper, 20, SHOP_ZEBRA_FLOOR, front.talk, null, front.talkAt ?? null);
const backRoom = makeRoom(SHOP_ZEBRA_BACK_LAYOUT, back.keeper, SHOP_ZEBRA_BACK_N, SHOP_ZEBRA_BACK_FLOOR, back.talk, null, back.talkAt ?? null);
const sq = (s: { c: number; r: number }) => `${s.c},${s.r}`;
/** A square of the front room's floor, not a wall or a solid piece (the guards' posts count as floor: they walk off them). */
const walkableSq = (c: number, r: number) => walkable(frontRoom, c, r) || ZEBRA_GUARDS.some((g) => Math.round(g.at[0]) === c && Math.round(g.at[1]) === r);

describe("the two rooms and the door between them (Nov 11)", () => {
  it("the front room's door at the back left leads to the back room: its squares blocked, its card on the two just inside, as the art has them", () => {
    expect(frontRoom.pass!.to).toBe("back");
    expect(frontRoom.pass!.squares.map(sq).sort()).toEqual(SHOP_ZEBRA_DOORS.back.squares.map(sq).sort());
    expect(frontRoom.pass!.inside.map(sq).sort()).toEqual(SHOP_ZEBRA_DOORS.back.inside.map(sq).sort());
    for (const s of frontRoom.pass!.squares) expect(frontRoom.blocked[s.r * 20 + s.c], sq(s)).toBe(1);
    for (const s of frontRoom.pass!.inside) expect(onPass(frontRoom, s.c, s.r), sq(s)).toBe(true);
    // (The way out to the town as ever: its card on the two squares inside the entrance.)
    expect(frontRoom.doors.map(sq).sort()).toEqual(SHOP_ZEBRA_DOORS.out.inside.map(sq).sort());
  });
  it("the back room's door leads back out front; it has no way out to the town", () => {
    expect(backRoom.pass!.to).toBe("front");
    expect(backRoom.pass!.inside.map(sq).sort()).toEqual(SHOP_ZEBRA_BACK_DOORS.front.inside.map(sq).sort());
    expect(backRoom.doors).toEqual([]);
  });
  it("you arrive just inside the door you came through", () => {
    expect(passArrive(backRoom)).toEqual({ c: 4, r: 9 });
    expect(passArrive(frontRoom)).toEqual({ c: 4, r: 7 });
  });
  it("a tap on the door walks you to just inside it", () => {
    const t = tapTarget(frontRoom, { c: 10, r: 15 }, 3, 6);
    expect(t.kind).toBe("pass");
    expect(onPass(frontRoom, t.dest!.c, t.dest!.r)).toBe(true);
  });
  it("Don Dough: you talk to him from the foot of his table (facing him across it); a tap on him, his chair or the table walks you there", () => {
    for (let r = 0; r < SHOP_ZEBRA_BACK_N; r++)
      for (let c = 0; c < SHOP_ZEBRA_BACK_N; c++) expect(inTalkRange(backRoom, c, r), `${c},${r}`).toBe((c === 8 && r === 6) || (c === 8 && r === 7));
    for (const [c, r] of [[4, 7], [6, 7], [5, 6]] as const) {
      const t = tapTarget(backRoom, { c: 4, r: 9 }, c, r);
      expect(t.kind, `${c},${r}`).toBe("keeper");
      expect(["8,6", "8,7"]).toContain(sq(t.dest!));
    }
  });
  it("the counter zebra has no crate yet: his Talk says he's in the back; Don's Challenge is open (his boss is in the game, admins first)", () => {
    expect(front).toMatchObject({ crate: null, kid: "zebrakeeper", roof: "bakery", chatTone: "day" });
    expect(front.says).toEqual(ZEBRA_BACK_LINES);
    expect(back).toMatchObject({ part: "back", name: "Don Dough", hideKid: true, chatTone: "night" });
    expect(canChallengeInside("zebra")).toBe(true);
    expect(introOf("zebra")).toMatchObject({ name: "Don Dough", fromDoor: true, seated: true, custom: true });
  });
});

describe("the guards' watch (the art's rule)", () => {
  const [a, b] = ZEBRA_GUARDS;
  it("each turns to your column, looking back over his shoulder once you're past him; never played as an animation", () => {
    // (Level with you: the middle frame; far ahead and far behind: the ends.)
    expect(watchFrame(a, 8, 17)).toBe(2);
    expect(watchFrame(a, 14, 17)).toBe(4);
    expect(watchFrame(a, 2, 17)).toBe(0);
    // (The mirrored guard faces west: your column east of him is behind him.)
    expect(watchFrame(b, 14, 17)).toBe(0);
    expect(watchFrame(b, 7, 17)).toBe(4);
    // (Past them, north: two squares less, over the shoulder.)
    expect(watchFrame(a, 10, 12)).toBe(ZEBRA_WATCH_FRAME(0));
    expect(NPC_ZEBRA_GUARD_A.anims.watch!.loop).toBe(false);
    expect(NPC_ZEBRA_GUARD_A.anims.watch!.frames).toHaveLength(5);
  });
});

const clips: SceneClips = Object.fromEntries(
  [["don", BOSS_ZEBRA], ["crew-c", NPC_ZEBRA_CREW_C], ["crew-d", NPC_ZEBRA_CREW_D], ["crew-e", NPC_ZEBRA_CREW_E], ["guard-a", NPC_ZEBRA_GUARD_A]].map(([k, ch]) => [
    k as string,
    Object.fromEntries(Object.entries(clipsOf(ch as typeof BOSS_ZEBRA)).map(([n, c]) => [n, { ms: c.ms, loop: !!(ch as typeof BOSS_ZEBRA).anims[n]!.loop }])),
  ]),
);

describe("the front room's lines", () => {
  it("a guard says his next line now and then, in turn; sooner while you're near; the counter zebra's Talk says his", () => {
    let r = 0;
    const s = new FrontScene(clips, () => (r = (r + 0.37) % 1), 0);
    const said: string[] = [];
    for (let t = 0; t < 120_000; t += 100) {
      s.step(t, false);
      const l = s.saying();
      if (l && said[said.length - 1] !== l.text) said.push(l.text);
    }
    expect(said.length).toBeGreaterThanOrEqual(6);
    said.forEach((l, i) => expect(l).toBe(ZEBRA_GUARD_LINES[i % ZEBRA_GUARD_LINES.length]!.text));
    // (Near them: no line further off than a near wait.)
    const n = new FrontScene(clips, () => 0.99, 0);
    let first = -1;
    for (let t = 0; t < 20_000 && first < 0; t += 100) {
      n.step(t, true);
      if (n.saying()) first = t;
    }
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThanOrEqual(SHOP_FEEL.zebra.guardNearMs[1] + 100);
    n.keeper(30_000, ZEBRA_BACK_LINES[0]!);
    expect(n.saying()).toEqual({ who: "keeper", text: ZEBRA_BACK_LINES[0] });
    // (A tapped guard: "He's in the back.", over anyone's.)
    n.guard(31_000, "guard-b", ZEBRA_BACK_LINES[1]!);
    expect(n.saying()).toEqual({ who: "guard-b", text: ZEBRA_BACK_LINES[1] });
  });
});

describe("the back table (Eric, Nov 10: the crew argue, he one-ups them)", () => {
  it("the chatter loops in order, a line at a time, the speaker on his talking, arguing or scoffing loop, the rest listening", () => {
    const s = new BackScene(clips, 0);
    const seen: string[] = [];
    const figs: ReturnType<BackScene["figs"]> = [];
    let total = 0;
    for (const ex of ZEBRA_CHATTER) for (const l of ex) total += lineMs(l.text);
    for (let t = 0; t < total + 60_000; t += 50) {
      expect(s.step(t)).toBeNull();
      const say = s.saying(t);
      if (!say) continue;
      if (seen[seen.length - 1] !== say.text) seen.push(say.text);
      s.figs(t, figs);
      expect(figs.map((f) => f.name).sort()).toEqual(["crew-c", "crew-d", "crew-e", "don"]);
      for (const f of figs) {
        if (f.name === say.who) expect(["sitTalk", "sitArgue", "sitScoff"], f.name).toContain(f.anim);
        else expect(["sitListen", "sitPuff"], f.name).toContain(f.anim);
        // (Don faces east as drawn; the crew turned to him, mirrored.)
        expect(f.flip, f.name).toBe(f.name !== "don");
      }
    }
    const all = ZEBRA_CHATTER.flat().map((l) => l.text);
    expect(seen.slice(0, all.length)).toEqual(all);
    expect(seen[all.length], "and from the top").toBe(all[0]);
  });
  it("the challenge beat: the crew stand and draw, aim at you with Fedora's line, Don waves them down, they lower, his challenge; the chatter stops for good", () => {
    const s = new BackScene(clips, 0);
    s.talk(5000);
    const steps: string[] = [];
    const lines: string[] = [];
    const crewAnims: string[] = [];
    const figs: ReturnType<BackScene["figs"]> = [];
    // (You at the foot of his table, east of them all, where his card is.)
    for (let t = 5000; t < 5000 + s.beatLength() + 4000; t += 20) {
      const st = s.step(t)!;
      if (steps[steps.length - 1] !== st) steps.push(st);
      const say = s.saying(t);
      if (say && lines[lines.length - 1] !== say.text) lines.push(say.text);
      s.figs(t, figs, 8, 7);
      const d = figs.find((f) => f.name === "crew-d")!;
      if (crewAnims[crewAnims.length - 1] !== d.anim) crewAnims.push(d.anim);
      // (Standing, the crew face you, east: as drawn; aiming, each his roll at your angle.)
      if (d.anim !== "sitListen") expect(d.flip).toBe(false);
      if (d.anim === "aimAt") expect(Math.floor(d.frame / ZEBRA_AIM_LOOP)).toBe(aimAt(ZEBRA_CREW[1].at, 8, 7).i);
    }
    expect(steps).toEqual(["stand", "draw", "aim", "relax", "lower", "challenge", "done"]);
    expect(lines).toEqual([ZEBRA_TALK.draw.text, ZEBRA_TALK.relax.text, ZEBRA_TALK.challenge.text]);
    // (Fedora stands a stagger after Toque: seated that moment.)
    expect(crewAnims).toEqual(["sitListen", "standUp", "draw", "aimAt", "lower", "puff"]);
    expect(s.talking()).toBe(true);
  });
  it("aiming, each follows you (Eric, Nov 11: \"pointing at where you are … when you run, it actually kind of follows your character\"): your side, your angle", () => {
    const s = new BackScene(clips, 0);
    s.talk(0);
    // (Mid-aim: Fedora's line is up.)
    let t = 0;
    while (s.saying(t)?.text !== ZEBRA_TALK.draw.text) t += 20;
    const at = (x: number, y: number) => Object.fromEntries(s.figs(t, [], x, y).filter((f) => f.name !== "don").map((f) => [f.name, { anim: f.anim, angle: Math.floor(f.frame / ZEBRA_AIM_LOOP), flip: f.flip }]));
    // East of them, at the table's foot: all face east; their angles down toward you.
    const east = at(8, 7);
    for (const p of ZEBRA_CREW) expect(east[p.who], p.who).toEqual({ anim: "aimAt", angle: aimAt(p.at, 8, 7).i, flip: false });
    // West of them, by the door: all turned west.
    const west = at(3, 9);
    for (const p of ZEBRA_CREW) expect(west[p.who], p.who).toEqual({ anim: "aimAt", angle: aimAt(p.at, 3, 9).i, flip: true });
    // (Level with them far east the roll is level; close below it tips down, never past the art's steepest.)
    expect(aimAt(ZEBRA_CREW[2].at, 11, 4.5).i).toBe(0);
    expect(ZEBRA_AIM_ANGLES[aimAt(ZEBRA_CREW[2].at, 8, 7).i]).toBeGreaterThanOrEqual(20);
    expect(aimAt(ZEBRA_CREW[1].at, 6.2, 9).i).toBe(ZEBRA_AIM_ANGLES.length - 1);
    // (Every aim frame is drawn: each angle a whole aim loop.)
    expect(clips["crew-d"]!.aimAt!.ms).toHaveLength(ZEBRA_AIM_ANGLES.length * ZEBRA_AIM_LOOP);
  });
});

/** The animations each room draws for its people (ShopRoom's loader, `people`). */
const CREW_BACK = ["sitListen", "sitTalk", "sitArgue", "sitPuff", "standUp", "draw", "aim", "aimAt", "lower", "puff", "walk", "carry"];
const BACK_ANIMS: Record<string, string[]> = { don: ["sitListen", "sitTalk", "sitScoff", "sitRelax", "idle"], "crew-c": CREW_BACK, "crew-d": CREW_BACK, "crew-e": CREW_BACK, "guard-a": ["walk", "carry"] };
const FRONT_ANIMS: Record<string, string[]> = { "guard-a": ["watch", "guard", "walk", "carry"], "guard-b": ["watch", "guard", "walk"], "crew-c": ["carry", "walk", "puff"], "crew-d": ["carry", "walk", "puff"], "crew-e": ["carry", "walk", "puff"] };

describe("the walk-out (Eric, Nov 11: \"watch all of them walk out, like pick up the stuff in the back and walk out\")", () => {
  const solid = (c: number, r: number) => !walkable(backRoom, c, r) && !backRoom.pass!.squares.some((q) => q.c === c && q.r === r);
  it("the set is kept before his table, on solid squares clear of the way in and his card's spots", () => {
    for (const q of ZEBRA_BACK_SET_SQUARES) expect(backRoom.blocked[q.r * SHOP_ZEBRA_BACK_N + q.c], `${q.c},${q.r}`).toBe(0);
    for (const k of Object.keys(ZEBRA_BACK_SET) as SetupItem[]) {
      const [c, r] = ZEBRA_BACK_SET[k];
      expect(ZEBRA_BACK_SET_SQUARES.some((q) => q.c === Math.round(c) && q.r === Math.round(r)), k).toBe(true);
    }
    // (With its squares solid, you still get from the door to his card's spot.)
    const room = makeRoom(SHOP_ZEBRA_BACK_LAYOUT, back.keeper, SHOP_ZEBRA_BACK_N, SHOP_ZEBRA_BACK_FLOOR, back.talk, null, back.talkAt ?? null);
    for (const q of ZEBRA_BACK_SET_SQUARES) room.blocked[q.r * SHOP_ZEBRA_BACK_N + q.c] = 1;
    expect(findPath(room, passArrive(room)!, { c: 8, r: 7 })).not.toBeNull();
    expect(findPath(room, { c: 8, r: 7 }, passArrive(room)!)).not.toBeNull();
  });
  it("four goons each pick up one thing and carry it out of the back door; Don follows, then you; nobody walks through a wall or the table", () => {
    const W = new WalkOut(clips, 1000);
    const figs: SceneFig[] = [];
    const carried: CarriedNow[] = [];
    const kept: SetupItem[] = [];
    const items = new Set<string>();
    const lastSeen = new Map<string, number>();
    let keptBefore = 4;
    for (let t = 1000; t <= W.youAt + 3000; t += 20) {
      W.figs(t, figs, carried);
      W.kept(t, kept);
      // (Each thing is either kept or carried, never both, never neither until it's out of the door.)
      for (const q of carried) {
        items.add(q.item);
        expect(kept, q.item).not.toContain(q.item);
      }
      expect(kept.length).toBeLessThanOrEqual(keptBefore);
      keptBefore = kept.length;
      for (const f of figs) {
        lastSeen.set(f.name, t);
        expect(BACK_ANIMS[f.name], `${f.name} ${f.anim}`).toContain(f.anim);
        // (On the floor or in the doorway: never on a wall, the table, Don's chair or the set. The crew step off the bench along its
        // front, where they stood up; Don gets up out of his chair.)
        const bench = f.r < 5.2 && f.c > 4.5 && f.c < 9.2;
        if (f.anim !== "sitListen" && !bench && !(f.name === "don" && f.r < 7.6)) expect(solid(Math.round(f.c), Math.round(f.r)) && f.r < 10, `${f.name} ${f.anim} at ${f.c.toFixed(2)},${f.r.toFixed(2)}`).toBe(false);
        // (Fading only through the door.)
        if ((f.a ?? 1) < 1) expect(f.r, f.name).toBeGreaterThan(10);
      }
      // (Nobody walks through anybody: every two of them in view more than half a square apart.)
      for (let i = 0; i < figs.length; i++)
        for (let j = i + 1; j < figs.length; j++) {
          const [p, q] = [figs[i]!, figs[j]!];
          if ((p.a ?? 1) > 0.3 && (q.a ?? 1) > 0.3) expect(Math.hypot(p.c - q.c, p.r - q.r), `${p.name} and ${q.name} at ${t}`).toBeGreaterThan(0.6);
        }
    }
    expect([...items].sort()).toEqual(["board", "bossChair", "table", "youChair"]);
    W.kept(W.youAt, kept);
    expect(kept).toEqual([]);
    // (The goons, then Don, are all through the door before you set off and reach it; all gone at the end.)
    for (const n of ["guard-a", "crew-c", "crew-d", "crew-e"]) expect(lastSeen.get(n)!, n).toBeLessThan(W.youAt + 1500);
    expect(W.goonsGone()).toBeLessThan(W.youAt + 1500);
    // (Don gets up once the last thing is picked up; you set off after him.)
    expect(W.kept(W.donAt, kept)).toEqual([]);
    expect(W.youAt).toBeGreaterThan(W.donAt);
    W.figs(W.youAt + 3000, figs, carried);
    expect(figs).toEqual([]);
    expect(carried).toEqual([]);
    expect(doorAlpha(9.5)).toBe(1);
    expect(doorAlpha(11)).toBe(0);
  });
});

describe("his challenge, in the front room (Eric, Nov 11: \"The main room is still where you fight\")", () => {
  const pad = marksOf(SHOP_ZEBRA_LAYOUT, "across", null, marksFeel(null, CHALLENGE_FEEL))!;
  const marks = seatedMarks(pad);
  const door = passArrive(frontRoom)!;
  it("a normal fight pad on the front room's floor, clear of the counter, the mixer and the walkway between the guards", () => {
    expect(pad.table).toEqual({ c: 10, r: 12 });
    const P = SHOP_ZEBRA_PAD;
    for (let r = P.r0; r <= P.r1; r++) for (let c = P.c0; c <= P.c1; c++) expect(frontRoom.blocked[r * 20 + c], `${c},${r}`).toBe(0);
    // (The walkway from the door up between the guards, columns 9-10 below the pad, stays open; the guards' squares too far to touch it.)
    for (let r = P.r1 + 1; r <= 18; r++) for (const c of [9, 10]) expect(frontRoom.blocked[r * 20 + c], `${c},${r}`).toBe(0);
  });
  it("the four goons carry the table, both chairs and the board out of the back door, set them up, and all five watch behind the table before his line", () => {
    const clipsFront: SceneClips = Object.fromEntries(
      [["crew-c", NPC_ZEBRA_CREW_C], ["crew-d", NPC_ZEBRA_CREW_D], ["crew-e", NPC_ZEBRA_CREW_E], ["guard-a", NPC_ZEBRA_GUARD_A], ["guard-b", NPC_ZEBRA_GUARD_A]].map(([k, ch]) => [
        k as string,
        Object.fromEntries(Object.entries(clipsOf(ch as typeof BOSS_ZEBRA)).map(([n, c]) => [n, { ms: c.ms, loop: !!(ch as typeof BOSS_ZEBRA).anims[n]!.loop }])),
      ]),
    );
    const S = new SetupScene(clipsFront, (a, b) => findPath(frontRoom, a, b), marks, door, ZEBRA_GUARDS[1].at, 0);
    const figs: SceneFig[] = [];
    const carried: CarriedNow[] = [];
    const seen = new Map<string, Set<string>>();
    const firstSeen = new Map<string, number>();
    const items = new Set<string>();
    for (let t = 0; t <= S.end() + 500; t += 25) {
      S.figs(t, figs, carried);
      for (const f of figs) (seen.get(f.name) ?? seen.set(f.name, new Set()).get(f.name)!).add(f.anim);
      for (const q of carried) items.add(q.item);
      // (Nobody stands on the counter, the mixer or a wall: every figure on the floor, rounded to its square.)
      // (Coming through the back door each starts behind it, out of sight behind the wall: nobody pops in.)
      for (const f of figs) expect(walkableSq(Math.round(f.c), Math.round(f.r)) || f.name === "guard-b" || (f.r < door.r - 0.5 && Math.abs(f.c - door.c) < 1), `${f.name} at ${f.c.toFixed(2)},${f.r.toFixed(2)}`).toBe(true);
      // (and the first frame anyone carrying shows, he's behind the door.)
      for (const f of figs) if (f.anim === "carry" && !firstSeen.has(f.name)) firstSeen.set(f.name, f.r);
      // (Only animations the front room draws for each (ShopRoom's loader): one it lacks would leave him undrawn, a gap.)
      for (const f of figs) expect(FRONT_ANIMS[f.name], `${f.name} ${f.anim}`).toContain(f.anim);
    }
    expect([...items].sort()).toEqual(["board", "bossChair", "table", "youChair"]);
    expect(S.placed(S.end()).sort()).toEqual(["board", "bossChair", "table", "youChair"]);
    for (const n of ["crew-c", "crew-d", "crew-e", "guard-a"]) expect([...seen.get(n)!], n).toContain("carry");
    for (const n of ["crew-c", "crew-d", "crew-e", "guard-a"]) expect(firstSeen.get(n)!, n).toBeLessThan(door.r - 1);
    // At the end: all five on their watch spots behind the table, facing it, none in front of the board, Don or you.
    S.figs(S.end() + 1, figs, carried);
    expect(figs).toHaveLength(5);
    expect(carried).toHaveLength(0);
    for (const f of figs) {
      expect(f.r, f.name).toBeLessThan(marks.table.r - 1.5);
      expect(f.c, f.name).toBeGreaterThan(marks.boss.c);
      expect(f.c, f.name).toBeLessThan(marks.you.c);
      expect(["puff", "guard"], f.name).toContain(f.anim);
    }
    // (All set before his line: the walk out (your way to your mark, a step a CHALLENGE_FEEL.walkStepMs), settling, facing, the hold.)
    const walk = findPath(frontRoom, door, marks.youSq)!.length * CHALLENGE_FEEL.walkStepMs + CHALLENGE_FEEL.settleMs;
    const line = timelineBeats(ZEBRA_INTRO.timeline).find((b) => b.step === "line")!.at;
    expect(S.end()).toBeLessThan(walk + line);
  });
});

describe("his intro, as data", () => {
  it("on the marks, a hold for the set-up, his line, his breadPop (its pop cued), Beanie's line, a beat; no God King attack; his own figure", () => {
    expect(timelineBeats(ZEBRA_INTRO.timeline).map((b) => b.step)).toEqual(["face", "setup", "line", "pop", "crew", "laugh", "done"]);
    expect(timelineCues(ZEBRA_INTRO.timeline).map((c) => c.cue)).toContain("pop");
    expect(ZEBRA_INTRO).toMatchObject({ noAttack: true, figure: BOSS_ZEBRA, mover: BOSS_ZEBRA });
    expect(Object.keys(introOf("zebra")!.cues)).toContain("pop");
    // (His line and Beanie's: the art's battle-start pair; Beanie's bubble up through the crew beat only.)
    expect(introOf("zebra")).toMatchObject({ line: ZEBRA_BATTLE_START.don, crewLine: ZEBRA_BATTLE_START.crew });
    const crew = timelineBeats(ZEBRA_INTRO.timeline).find((b) => b.step === "crew")!;
    const pop = timelineBeats(ZEBRA_INTRO.timeline).find((b) => b.step === "pop")!;
    expect(timelineAt(ZEBRA_INTRO.timeline, pop.at + 10).cast.crewLine?.on).toBeFalsy();
    expect(timelineAt(ZEBRA_INTRO.timeline, crew.at + 10).cast.crewLine?.on).toBe(true);
  });

  it("his wipe is his bread splash (Eric: \"loaves of bread as the splash screen\"), its whoosh and tumble his own sounds", () => {
    expect(ZEBRA_INTRO.storm).toEqual({ tile: INTRO_ZEBRA_STORM, front: INTRO_ZEBRA_FRONT });
    expect(INTRO_ZEBRA_STORM.anims.idle!.frames[0]!.cue).toBe("tumble");
    expect(introOf("zebra")!.cues).toMatchObject({ storm: "zebraWhoosh", tumble: "zebraTumble", pop: "zebraPop" });
    expect(introOf("zebra")!.cues.wipe).toBeUndefined();
  });
});

describe("the words", () => {
  it("every line fits a speech bubble (the art's: none over 58 characters), and none says \"stupid\"", () => {
    const all = [...ZEBRA_CHATTER.flat(), ...ZEBRA_GUARD_LINES, ...Object.values(ZEBRA_TALK)].map((l) => l.text).concat(ZEBRA_BACK_LINES, ZEBRA_OUTSIDE_LINES);
    for (const l of all) {
      expect(l.length, l).toBeLessThanOrEqual(58);
      expect(l, l).not.toMatch(/stupid/i);
    }
    expect(ZEBRA_CHATTER).toHaveLength(22);
    expect(ZEBRA_GUARD_LINES).toHaveLength(10);
  });
  it("\"he's in the back\" (Eric, Nov 11): 3 to 4 lines each in the room and out front, picked at random, never twice running", () => {
    for (const lines of [ZEBRA_BACK_LINES, ZEBRA_OUTSIDE_LINES]) {
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines.length).toBeLessThanOrEqual(4);
      for (const l of lines) expect(l).toMatch(/back|inside/i);
      const seen = new Set<string>();
      let last: string | null = null;
      for (let i = 0; i < 200; i++) {
        const l = pickLine(lines, last);
        expect(l).not.toBe(last);
        seen.add((last = l));
      }
      expect(seen.size).toBe(lines.length);
    }
    expect(pickLine(["only"], "only", () => 0.999)).toBe("only");
  });
});

describe("the room's sounds (quiet)", () => {
  it("each is numbers only and well under a piece's move", () => {
    // (The room's four; Don Dough's own sounds share the module, zebra-sounds.ts, and their test is zebra.test.ts.)
    for (const name of ZEBRA_ROOM_SOUNDS) {
      const d = zebraSound(name, 48000);
      let peak = 0;
      for (const v of d) {
        expect(Number.isFinite(v), name).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, name).toBeGreaterThan(0.005);
      expect(peak, name).toBeLessThan(MOVE_PEAK * 0.6);
    }
  });
});
