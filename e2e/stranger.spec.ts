import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { localSql, openBossRaid, submitMove, tapInTown, test } from "./helpers.ts";

/**
 * The Stranger (Eric, Nov 27; docs/decisions/2026-11-27-stranger-rules.md), on a phone: his Frostfire strike (your piece frozen for your
 * next turn, thawed the turn after, then its square burns what's left on it), his locked card in the Boss Battle picker (a tap shows him
 * and how to unlock him, every way to play greyed), the unlock once Battle Tower floor 10, his, is won (the server's record of it), and his
 * Storm of Two Worlds (docs/decisions/2026-11-27-stranger-storm.md: its opening scene, then Ice and Fire turns). Live since his storm;
 * `?wip=1` stays on the links (a test switch, harmless now).
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase?.kind ?? "none").catch(() => "none");
type Turn = { fen: string; allowed: string[] | null; strike: { turn: number; square: string; frozenUntil: number; burnAt: number } | null; burn: { at: number; square: string; piece?: string } | null; turn: number; kinds: string[] };
const turnNow = (page: Page) =>
  page.evaluate(() => {
    const m = (window as any).match;
    if (m?.phase?.kind !== "play" || Date.now() < m.phase.startsAt + 300) return null;
    const p = m.boss?.powers;
    return { fen: m.phase.board.fen, allowed: p?.allowed ?? null, strike: p?.stranger?.strike ?? null, burn: p?.stranger?.burn ?? null, turn: p?.turn ?? 0, kinds: (p?.events ?? []).map((e: any) => e.kind) } as Turn;
  });

/** Waits for your turn (the board in play, settled), up to `ms`. */
async function yourTurn(page: Page, ms = 60_000): Promise<Turn> {
  let t: Turn | null = null;
  await expect.poll(async () => !!(t = await turnNow(page)), { timeout: ms }).toBe(true);
  return t!;
}

/** Your move: the first allowed move not from `keep` (a knight's if it can), never from `keep` unless nothing else can move. */
async function moveBut(page: Page, t: Turn, keep: string | null) {
  const legal = new Chess(t.fen).moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion ?? ""), from: m.from, knight: m.piece === "n" }));
  const ok = legal.filter((m) => !t.allowed || t.allowed.includes(m.uci)).sort((a, b) => (a.uci < b.uci ? -1 : 1));
  const pick = ok.find((m) => m.from !== keep && m.knight) ?? ok.find((m) => m.from !== keep) ?? ok[0]!;
  await submitMove(page, pick.uci, t.fen);
}

test("his Frostfire on a phone: your piece frozen a turn (no move of it, its ice), thawed the next (its square ablaze), then the square burns it", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=stranger&wip=1&power=frostfire`);
  await openBossRaid(page);
  await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  await expect.poll(() => phase(page), { timeout: 45_000 }).toBe("play");
  expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("stranger");
  // Your moves until his strike stands (the test switch: from his first move).
  let t = await yourTurn(page);
  for (let i = 0; i < 6 && !t.strike; i++) {
    await moveBut(page, t, null);
    t = await yourTurn(page);
  }
  const st = t.strike!;
  expect(st, "his strike after his first move").toBeTruthy();
  expect(t.turn).toBe(st.turn);
  // Frozen: no move of it allowed, its ice on the board.
  expect((t.allowed ?? []).some((m) => m.startsWith(st.square))).toBe(false);
  await expect(page.locator(`.pw-ice[data-square="${st.square}"]`)).toBeVisible();
  const kind = new Chess(t.fen).get(st.square as any)!.type;
  await moveBut(page, t, st.square);
  // Thawed: its ice gone, its square ablaze (the fire tile, its countdown 1); its moves allowed again if it has any.
  t = await yourTurn(page);
  expect(t.turn).toBe(st.burnAt);
  await expect(page.locator(`.pw-ice[data-square="${st.square}"]`)).toHaveCount(0);
  await expect(page.locator(`.pw-frostfire[data-square="${st.square}"]`)).toBeVisible();
  const own = new Chess(t.fen).moves({ verbose: true }).filter((m) => m.from === st.square).map((m) => m.from + m.to + (m.promotion ?? ""));
  if (own.length) expect(t.allowed === null || own.some((m) => t.allowed!.includes(m))).toBe(true);
  // Left there: the square burns it as your move lands.
  const left = new Chess(t.fen).get(st.square as any);
  await moveBut(page, t, st.square);
  t = await yourTurn(page);
  expect(t.burn?.at).toBe(st.burnAt);
  expect(t.burn?.square).toBe(st.square);
  if (left && left.type !== "k" && t.burn?.piece === kind) expect(new Chess(t.fen).get(st.square as any)?.color ?? null).not.toBe("w");
  await expect(page.locator(`.pw-frostfire[data-square="${st.square}"]`)).toHaveCount(0);
  expect(errors).toEqual([]);
});

/** The brightest pixel (0-255, its three colors' mean) in a box of the page as it's drawn now: the pixels are the point (the storm's shade). */
async function brightest(page: Page, box: { x: number; y: number; width: number; height: number }): Promise<number> {
  const shot = await page.screenshot({ clip: box });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = img.width;
    cv.height = img.height;
    const g = cv.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let most = 0;
    for (let i = 0; i < d.length; i += 4) most = Math.max(most, (d[i]! + d[i + 1]! + d[i + 2]!) / 3);
    return most;
  }, shot.toString("base64"));
}

test("his Storm of Two Worlds on a phone: the opening scene (10 to 12 s, his figure whole on screen), the ring, an Ice turn and a Fire turn, the burn", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (Every frame from the start, recorded in the page: the scene's own element and his figure's box, the ring, the dock's words.)
  await page.addInitScript(() => {
    const w = window as any;
    w.__storm = { scene: [] as number[], outside: [] as string[], ring: 0, drawn: 0, rift: [] as number[], burn: 0, docks: [] as string[], wide: [] as number[], swords: false, early: [] as string[], build: [] as number[], riftSee: [] as string[], home: [] as number[] };
    const look = () => {
      const fig = document.querySelector(".pm-storm .sg-fig");
      if (document.querySelector(".pm-storm")) w.__storm.scene.push(Date.now());
      // (Eric, Nov 27: "it showed the tornado before he even initiated anything": from the battle's first frame to his first sword,
      // nothing of the storm is drawn: no ring, no rift, no shade. Then the ring gathers: its strength through his swords.)
      const stage = document.querySelector(".pm-storm")?.getAttribute("data-stage") ?? "";
      const art = w.__stormArt as { ring: number; rift: number; strength: number } | undefined;
      if (stage && stage !== "leap" && stage !== "draw") w.__storm.swords = true;
      if (!w.__storm.swords) {
        const shade = document.querySelector(".sg-shade");
        const seen = [(art?.strength ?? 0) > 0 || (art?.ring ?? -1) >= 0 ? "ring" : "", (art?.rift ?? -1) >= 0 ? "rift" : "", shade && Number(getComputedStyle(shade).opacity) > 0 ? "shade" : "", !stage && document.querySelector(".sg-storm, .sg-rift") ? "canvas" : ""].filter(Boolean).join("+");
        if (seen && !w.__storm.early.includes(seen)) w.__storm.early.push(seen);
      }
      if (stage === "swords") w.__storm.build.push(art?.strength ?? 0);
      const riftEl = document.querySelector(".sg-rift");
      const see = riftEl ? getComputedStyle(riftEl).opacity : "";
      if (see && !w.__storm.riftSee.includes(see)) w.__storm.riftSee.push(see);
      // (His size, Eric, Nov 27: "it almost looked like his size shrunk a bit": while its banner is up he stands in his place, his
      // figure's box there his own figure's, to a pixel: its width against his bar figure's.)
      const own = document.querySelector(".boss-char.ch-stranger .boss-char-sprite");
      if (stage === "leap" && fig && own && document.querySelector(".fight-banner.storm")) w.__storm.home.push(Math.abs(fig.getBoundingClientRect().width - own.getBoundingClientRect().width), Math.abs(fig.getBoundingClientRect().left - own.getBoundingClientRect().left), Math.abs(fig.getBoundingClientRect().top - own.getBoundingClientRect().top));
      if (fig) {
        // (His drawing's box, its frame's transparent margins aside: whole on screen at every frame.)
        const r = fig.getBoundingClientRect();
        if (r.left + r.width * 0.25 < -1 || r.right - r.width * 0.25 > innerWidth + 1 || r.top + r.height * 0.1 < -1 || r.bottom > innerHeight + 1) w.__storm.outside.push(`${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
      if (document.querySelector(".sg-storm")) {
        w.__storm.ring++;
        // (Its art as its canvases last drew it: the ring's frame from its sheet, the rift's sheet frame under the pieces.)
        if (w.__stormArt?.ring >= 0) w.__storm.drawn++;
        if (w.__stormArt?.rift >= 0 && !w.__storm.rift.includes(w.__stormArt.rift)) w.__storm.rift.push(w.__stormArt.rift);
        // (Its ring past the screen's edge is cut, never scrolled to: the review of #1009, S1.)
        const sw = document.documentElement.scrollWidth;
        if (sw > innerWidth && !w.__storm.wide.includes(sw)) w.__storm.wide.push(sw);
      }
      // (The fire turn's burn, drawn as his thinking begins.)
      if (document.querySelector(".pm-storm-burn .pw-burns")) w.__storm.burn++;
      // (The storm's words in the dock: each one whole, never cut short.)
      for (const el of document.querySelectorAll<HTMLElement>(".boss-dock .dock-line, .boss-dock .through-note")) {
        const dock = `${el.textContent?.trim() ?? ""}${el.scrollWidth > el.clientWidth + 1 ? ` [cut] ${el.scrollWidth}/${el.clientWidth}` : ""}`;
        if (/Ice:|Fire:|marks burnt|storm swirls|spared/.test(dock) && !w.__storm.docks.includes(dock)) w.__storm.docks.push(dock);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  // (A narrow phone, 360 px: the dock's words measured at their tightest.)
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=stranger&wip=1&power=storm`);
  await openBossRaid(page);
  await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  await expect.poll(() => phase(page), { timeout: 45_000 }).toBe("play");
  expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("stranger");
  type Pick = { turn: number; kind: "fire" | "ice"; squares: string[]; free?: string[] } | null;
  const pickNow = () => page.evaluate(() => {
    const p = (window as any).match?.boss?.powers;
    const pk = p?.stranger?.pick;
    return (pk && pk.turn === p.turn ? pk : null) as Pick;
  });
  // The warning as turn 2 begins, the storm as turn 3 does (the test switch): your moves until its turns have both kinds.
  const kinds = new Set<string>();
  let burnt = false;
  // (The storm's shade, Eric, Nov 27: "everything should get a little dulled, so it's more of a focus on the board": the move list's
  // brightest pixel before the storm and in it.)
  const rowBox = async () => (await page.locator(".boss-dock .mv-row").last().boundingBox())!;
  let litBefore = 0;
  let shaded = false;
  for (let i = 0; i < 8 && kinds.size < 2; i++) {
    const t = await yourTurn(page, 90_000);
    const pick = await pickNow();
    if (!pick && !litBefore && (await page.locator(".boss-dock .mv-row").count())) litBefore = await brightest(page, await rowBox());
    if (pick && !shaded) {
      shaded = true;
      // Everything but the board about half as bright, the board's row over the shade, and a tap goes through it.
      await expect.poll(() => page.evaluate(() => Number(getComputedStyle(document.querySelector(".sg-shade")!).opacity)), { timeout: 5000 }).toBe(1);
      const box = await rowBox();
      const ring = (await page.locator(".sg-storm").boundingBox())!;
      expect(box.y, "the move list's last row is clear of the ring's flames").toBeGreaterThan(ring.y + ring.height);
      const lit = await brightest(page, box);
      expect(litBefore, "the move list read before the storm").toBeGreaterThan(150);
      expect(lit / litBefore, "the move list about half as bright (45 to 55% darker)").toBeGreaterThan(0.42);
      expect(lit / litBefore).toBeLessThan(0.6);
      const layer = await page.evaluate(
        ([x, y]) => {
          const shade = getComputedStyle(document.querySelector(".sg-shade")!);
          return { taps: shade.pointerEvents, shade: Number(shade.zIndex), board: Number(getComputedStyle(document.querySelector(".board-row")!).zIndex), under: !!document.elementFromPoint(x!, y!)?.closest(".boss-dock") };
        },
        [box.x + box.width / 2, box.y + box.height / 2],
      );
      expect(layer.taps).toBe("none");
      expect(layer.under, "a tap on the move list reaches it").toBe(true);
      expect(layer.board, "the board's row over the shade").toBeGreaterThan(layer.shade);
    }
    if (pick?.kind === "ice") {
      kinds.add("ice");
      // Only your king's moves and the free pieces': every other piece of yours frozen, its ice on the board.
      expect(pick.squares.length).toBeGreaterThan(0);
      expect((t.allowed ?? []).every((m) => pick.free!.includes(m.slice(0, 2)) || new Chess(t.fen).get(m.slice(0, 2) as any)?.type === "k")).toBe(true);
      for (const sq of pick.squares) await expect(page.locator(`.pw-ice[data-square="${sq}"]`)).toHaveCount(1);
      await moveBut(page, t, null);
    } else if (pick?.kind === "fire") {
      kinds.add("fire");
      for (const sq of pick.squares) await expect(page.locator(`.pw-storm-fire[data-square="${sq}"]`)).toHaveCount(1);
      // A marked piece of yours left where it stands: the burn takes it as your move lands. None: a move onto a mark.
      const chess = new Chess(t.fen);
      const mine = pick.squares.filter((sq) => chess.get(sq as any)?.color === "w" && chess.get(sq as any)?.type !== "k");
      const legal = chess.moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion ?? ""), from: m.from, to: m.to, piece: m.piece }));
      const ok = legal.filter((m) => !t.allowed || t.allowed.includes(m.uci));
      const move = mine.length ? ok.find((m) => !pick.squares.includes(m.from) && !pick.squares.includes(m.to)) : ok.find((m) => pick.squares.includes(m.to) && m.piece !== "k");
      const target = mine[0] ?? move?.to;
      await submitMove(page, (move ?? ok[0])!.uci, t.fen);
      const after = await yourTurn(page, 90_000);
      const sc = await page.evaluate(() => (window as any).match.boss.powers.stranger?.scorch ?? null);
      expect(sc?.at).toBe(pick.turn);
      const b = sc.burnt.find((x: { square: string }) => x.square === target);
      if (move && target && b?.piece && !b.spared) {
        expect(new Chess(after.fen).get(target as any)?.color ?? null).not.toBe("w");
        burnt = true;
      }
    } else await moveBut(page, t, null);
  }
  expect([...kinds].sort()).toEqual(["fire", "ice"]);
  expect(burnt, "a marked piece of yours burnt").toBe(true);
  const rec = await page.evaluate(() => (window as any).__storm as { scene: number[]; outside: string[]; ring: number; drawn: number; rift: number[]; burn: number; docks: string[]; wide: number[]; early: string[]; build: number[]; riftSee: string[]; home: number[] });
  expect(shaded, "the shade checked on a storm turn").toBe(true);
  // Nothing of the storm before his first sword; then the ring gathers from nothing to whole, never at once.
  expect(rec.early, "nothing of the storm drawn before his first sword").toEqual([]);
  expect(rec.build.length).toBeGreaterThan(30);
  expect(rec.build[0]!, "the ring from nothing").toBeLessThan(0.1);
  expect(rec.build.at(-1)!, "the ring whole by his grip").toBeGreaterThan(0.9);
  expect(rec.build.every((v, i) => i === 0 || v >= rec.build[i - 1]!), "the ring only ever gathers").toBe(true);
  expect(new Set(rec.build).size, "it builds in many steps").toBeGreaterThan(20);
  // The rift at half opacity, its opening and its stages alike.
  expect(rec.riftSee).toEqual(["0.5"]);
  // His figure's box in his place, his own figure's (never a jump in size or place as the scene takes him over).
  expect(rec.home.length).toBeGreaterThan(30);
  expect(Math.max(...rec.home), "his figure's box in his place, within a pixel of his own").toBeLessThan(1);
  expect(rec.wide, "no sideways scroll while the storm's ring shows").toEqual([]);
  expect(rec.burn, "the burn drawn as his thinking began").toBeGreaterThan(5);
  // (Both kinds' words seen, after his name as each turn began and through your turn.)
  expect(rec.docks.length).toBeGreaterThanOrEqual(4);
  expect(rec.docks.filter((d) => d.includes("[cut]"))).toEqual([]);
  // The scene: 10 to 12 s from his leap (its banner's 2.25 s before it), every frame of him whole on screen.
  const ms = rec.scene.at(-1)! - rec.scene[0]!;
  expect(ms).toBeGreaterThan(10_500);
  expect(ms).toBeLessThan(13_500);
  expect(rec.outside).toEqual([]);
  expect(rec.ring).toBeGreaterThan(60);
  // Its art (drawn offline, played back): the ring drawn from its sheet through the storm; the rift torn open in the scene (the
  // opening's frames, 12 on in its sheet), then whole on the storm's first turn (frames 0 to 3) and healing on its second (4 to 7).
  expect(rec.drawn, "the ring's frames drawn from its sheet").toBeGreaterThan(60);
  expect(rec.rift.some((f) => f >= 12), "the rift's opening").toBe(true);
  expect([...new Set(rec.rift.filter((f) => f < 12).map((f) => Math.floor(f / 4)))].sort().slice(0, 2), "the rift's first two stages").toEqual([0, 1]);
  expect(errors).toEqual([]);
});

test("his locked card: a tap shows him and how to unlock him, every way to play greyed; floor 10 (his): out of the elevator with his two lines and his blades, won, his notice once, and he's yours to pick", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(`/?debug&wip=1`);
  await openBossRaid(page);
  const tiles = page.getByRole("radiogroup", { name: "Bosses" });
  const locked = tiles.getByRole("radio", { name: "Locked boss: The Stranger. Beat him on Battle Tower floor 10" });
  await expect(locked).toBeVisible();
  await expect(locked).toHaveClass(/bs-locked/);
  await locked.click();
  await expect(page.locator(".bs-name")).toHaveText("The Stranger");
  // (Every way to play: shown, greyed and locked, never hidden.)
  const alone = page.getByRole("main").getByRole("button", { name: /^Boss alone/ });
  await expect(alone).toBeVisible();
  await expect(alone).toBeDisabled();
  await expect(alone).toHaveClass(/rd-locked/);

  // Up the tower to floor 10 (the deal set to floor 9 in the local database), floor 9 won: the server deals floor 10, him alone.
  const made = await page.evaluate(async () => {
    const run = await fetch("/api/tower/run", { method: "POST", body: "{}", credentials: "same-origin", headers: { "content-type": "application/json" } });
    const me = await (await fetch("/api/me", { credentials: "same-origin" })).json();
    return { ok: run.ok, user: me.user.id as string };
  });
  expect(made.ok).toBe(true);
  const floors = Array.from({ length: 9 }, (_, i) => (i % 2 ? ["gingerbread"] : ["clown"]));
  await localSql(page, "UPDATE tower_runs SET floor = 9, met = ? WHERE user_id = ? AND status = 'open'", JSON.stringify({ floors, deck: [], decks: 1 }), made.user);
  const climb = () =>
    page.evaluate(async () => {
      const post = (path: string, body: object) => fetch(path, { method: "POST", body: JSON.stringify(body), credentials: "same-origin", headers: { "content-type": "application/json" } }).then((r) => r.json());
      const start = await post("/api/tower/floor/start", {});
      const end = await post("/api/tower/floor/finish", { fight: start.fight.id, outcome: "won" });
      const state = await (await fetch("/api/tower", { credentials: "same-origin" })).json();
      return { floor: start.floor as number, bosses: start.bosses as string[], best: end.best as number, next: state.runs.solo as { floor: number; bosses: string[] } | null, unlocked: state.unlocked as string[] };
    });
  const nine = await climb();
  expect([nine.floor, nine.best, nine.unlocked]).toEqual([9, 9, []]);
  expect(nine.next).toMatchObject({ floor: 10, bosses: ["stranger"] });
  // Floor 10 in the app (Eric, Nov 27: "he needs to come out of the elevator still ... the first thing he says is like 'you must be pretty
  // strong to have gotten this far' ... then he says something cool, and then the fight starts ... he could draw his blades"): the
  // clerk's Continue, up the elevator, his entrance; every frame of it recorded in the page from before it can begin.
  await page.goto(`/town?debug&pace=quick&sky=day&win=1`);
  await expect(page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  const tower = await tapInTown(page, "home", "tower", page.getByRole("dialog", { name: "Battle Tower", exact: true }));
  await tower.getByRole("button", { name: "Go in" }).click();
  const room = page.locator("canvas.town-shop-canvas");
  await expect(room).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  await expect(room).toHaveAttribute("data-room", "tower");
  const clerk = page.getByRole("dialog", { name: "Clerk", exact: true });
  await expect(async () => {
    if (await clerk.isVisible()) return;
    const xy = await page.evaluate(() => (window as any).__shopAt?.("keeper") ?? null);
    const cv = xy && (await room.boundingBox());
    expect(xy && cv, "the clerk on screen").toBeTruthy();
    await page.mouse.click(cv!.x + xy!.x, cv!.y + xy!.y);
    await expect(clerk).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 40_000 });
  await page.evaluate(() => {
    const w = window as any;
    w.__entrance = [] as unknown[];
    const look = () => {
      const f = w.__towerFloor?.();
      const cv = document.querySelector("canvas.town-shop-canvas")?.getBoundingClientRect();
      if (f?.mode === "fight" && f.floor === 10 && f.t !== null) w.__entrance.push({ t: f.t, go: f.go, line: f.entrance?.line ?? null, anim: f.entrance?.anim ?? null, box: f.entrance && cv ? [f.entrance.x, f.entrance.y, f.entrance.x + f.entrance.w, f.entrance.y + f.entrance.h, cv.width, cv.height] : null });
      if (w.__entrance.length < 4000) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await clerk.getByRole("button", { name: "Continue: floor 10" }).click();
  // (STILLS=<dir>: his entrance's frames, true screenshots one after another, each named by its ms into the room, for its GIF.)
  if (process.env.STILLS) {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const dir = `${process.env.STILLS}/entrance-${test.info().project.name}`;
    mkdirSync(dir, { recursive: true });
    for (let n = 0; n < 600 && (await phase(page)) !== "play"; n++) {
      const t = await page.evaluate(() => (window as any).__towerFloor?.()?.t ?? null);
      const shot = await page.screenshot({ type: "jpeg", quality: 90, scale: "css" });
      if (t !== null) writeFileSync(`${dir}/${String(Math.round(t) + 100000)}.jpg`, shot);
    }
  }
  await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
  expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("stranger");
  type Seen = { t: number; go: number; line: string | null; anim: string | null; box: number[] | null };
  const seen = (await page.evaluate(() => (window as any).__entrance)) as Seen[];
  const drawn = seen.filter((f) => f.box);
  // About 10 s from the room's first frame; his two lines one after the other, each up about 3 s; then his blades, held as the match begins.
  expect(seen[0]!.go, "his entrance, about 10 s").toBeGreaterThan(8500);
  expect(seen[0]!.go).toBeLessThan(11_500);
  const lines = [...new Set(drawn.map((f) => f.line).filter(Boolean))];
  expect(lines).toEqual(["You climbed this far. You must be strong.", "I crossed worlds for a real fight. Be one."]);
  for (const l of lines) {
    const up = drawn.filter((f) => f.line === l);
    expect(up.at(-1)!.t - up[0]!.t, `"${l}" up about 3 s`).toBeGreaterThan(2500);
  }
  expect([...new Set(drawn.map((f) => f.anim))], "at rest, then his draw, then his blades held").toEqual(["idle", "draw", "ready"]);
  expect(drawn.find((f) => f.anim === "draw")!.t, "his blades after his second line").toBeGreaterThan(drawn.filter((f) => f.line === lines[1]).at(-1)!.t);
  // (His figure whole in the room's view at every frame: Eric, Nov 4, sprites always on screen.)
  expect(drawn.filter((f) => f.box![0]! + (f.box![2]! - f.box![0]!) * 0.25 < 0 || f.box![2]! - (f.box![2]! - f.box![0]!) * 0.25 > f.box![4]! || f.box![1]! + (f.box![3]! - f.box![1]!) * 0.1 < 0 || f.box![3]! > f.box![5]!).length, "his figure in the room's view").toBe(0);
  // Won (the test's quick mate): the floor's end, then his notice in the game's blue window, once.
  await submitMove(page, "h5f7");
  await expect(page.getByTestId("es-line")).toHaveText("Floor 10 cleared!", { timeout: 120_000 });
  const notice = page.getByRole("dialog", { name: "The Stranger is now available in Boss Battle" });
  await expect(notice).toBeVisible({ timeout: 30_000 });
  await expect(notice).toHaveClass(/ff-window/);
  await expect(notice.getByRole("button")).toHaveText(["▶ OK"]);
  await notice.getByRole("button", { name: "OK" }).click();
  await expect(notice).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("brc.unlock.told"))).toBe('["stranger"]');
  // (Once: the server has him unlocked, this device has said so; nothing brings it back on this screen.)
  await page.waitForTimeout(1500);
  await expect(notice).toHaveCount(0);
  const ten = await page.evaluate(async () => {
    const state = await (await fetch("/api/tower", { credentials: "same-origin" })).json();
    return { best: state.best.solo as number, unlocked: state.unlocked as string[] };
  });
  expect([ten.best, ten.unlocked]).toEqual([10, ["stranger"]]);
  // Back on the picker: his card unlocked, named as any other; a tap picks him, START's ways to play open.
  await page.goto(`/?debug&wip=1`);
  await openBossRaid(page);
  await expect(page.getByRole("heading", { name: "Boss Battle", exact: true })).toBeVisible();
  const open = tiles.getByRole("radio", { name: "The Stranger", exact: true });
  await expect(open).toBeVisible({ timeout: 20_000 });
  await expect(open).not.toHaveClass(/bs-locked/);
  await open.click();
  await expect(page.locator(".bs-name")).toHaveText("The Stranger");
  await expect(page.getByRole("main").getByRole("button", { name: /^Boss alone/ })).toBeEnabled();
  // (Boss alone's menu lists him: the review of #1000 found it empty for a boss unlocked by a win.)
  await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  await expect(page.locator(".boss-menu-list .boss-row:not(.match)")).toHaveCount(1);
  await expect(page.locator(".boss-menu-list .boss-row:not(.match)")).toHaveAttribute("aria-label", /^The Stranger, /);
});

/** Every frame from now (an init-free recorder: started before your move goes in), for his finisher's test: what the page draws. */
type Frame = { t: number; dock: string | null; stage: string | null; kind: string | null; pieces: string[]; thinking: boolean; phase: string; fig: number[] | null; vw: number; vh: number };
const record = (page: Page, square: string) =>
  page.evaluate((sq) => {
    const log: unknown[] = [];
    (window as any).__fin = log;
    const end = performance.now() + 60_000;
    const frame = () => {
      const m = document.querySelector(".pm-finisher");
      const r = document.querySelector(".sg-fig")?.getBoundingClientRect();
      const ph = (window as any).match?.phase;
      log.push({
        t: performance.now(),
        dock: document.querySelector(".boss-char")?.getAttribute("data-anim") ?? null,
        stage: m?.getAttribute("data-stage") ?? null,
        kind: m?.getAttribute("data-finisher") ?? null,
        pieces: [...document.querySelectorAll(`.hb-board piece[data-square="${sq}"]:not(.fading)`)].map((e) => e.className),
        thinking: !!ph?.thinking,
        phase: ph?.kind ?? "",
        fig: r ? [r.left, r.top, r.right, r.bottom] : null,
        vw: innerWidth,
        vh: innerHeight,
      });
      if (performance.now() < end) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, square);

test("his finisher: your bishop takes his knight (he blocks), he takes your bishop back: his hop and his cut on it, his piece on its square as it kills it, then his move", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (The test switch: the battle starts where your bishop can take his knight, and he takes a piece of yours back; the clean cut.)
  await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=stranger&wip=1&power=finisher-cut`);
  await openBossRaid(page);
  await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  await expect.poll(() => phase(page), { timeout: 45_000 }).toBe("play");
  const t = await yourTurn(page);
  const crowd: "w" | "b" = await page.evaluate(() => (window as any).match.boss.crowdSide);
  const [take, square] = crowd === "w" ? ["g5f6", "f6"] : ["g4f3", "f3"];
  const mine = crowd === "w" ? "white" : "black";
  await record(page, square);
  await submitMove(page, take, t.fen);
  await yourTurn(page);
  const log: Frame[] = await page.evaluate(() => (window as any).__fin);
  // He blocks as your bishop takes his knight (his thinking: a piece of his taken that isn't a pawn), and his hop comes as the block ends
  // (his thinking lasts at least FINISHER_BLOCK_MS, 1800; no wait after it: before Nov 27 it came 3 s or more after the block began).
  const blocked = log.findIndex((f) => f.thinking && f.dock === "block");
  expect(blocked).toBeGreaterThanOrEqual(0);
  expect(log.find((f) => f.stage)!.t - log[blocked]!.t).toBeLessThan(2700);
  // His finisher while he still thinks: the hop, the strike, the piece gone, the hop back, in that order; the cut, as switched.
  const fin = log.filter((f) => f.stage);
  expect([...new Set(fin.map((f) => f.stage))]).toEqual(["hop", "strike", "gone", "back"]);
  expect([...new Set(fin.map((f) => f.kind))]).toEqual(["cut"]);
  expect(fin.every((f) => f.thinking)).toBe(true);
  // Your bishop on its square until his cut takes it; from then his piece on it (Eric, Nov 27: "capture the moment he kills it"), before
  // he's home, and no piece of yours there; his move then shows the board as it already is, his piece on it.
  const his = crowd === "w" ? "black" : "white";
  const gone = log.findIndex((f) => f.stage === "gone");
  const moved = log.findIndex((f, i) => i > gone && !f.thinking && f.phase === "boss");
  expect(gone).toBeGreaterThan(0);
  expect(moved).toBeGreaterThan(gone);
  expect(log.slice(log.findIndex((f) => f.stage === "strike"), gone - 2).every((f) => f.pieces.some((c) => c.includes(`${mine} bishop`)))).toBe(true);
  expect(log.slice(gone, moved).filter((f) => f.pieces.some((c) => c.includes(mine)))).toEqual([]);
  expect(log.slice(gone, moved).filter((f) => !f.pieces.some((c) => c.includes(his)))).toEqual([]);
  expect(log.some((f) => f.stage === "back" && f.pieces.some((c) => c.includes(his)))).toBe(true);
  expect(log.slice(moved, moved + 30).every((f) => f.pieces.some((c) => c.includes(his)))).toBe(true);
  // His figure on the board whole on the screen, every frame (Eric's rule).
  const off = fin.filter((f) => f.fig && (f.fig[0]! < 0 || f.fig[1]! < 0 || f.fig[2]! > f.vw || f.fig[3]! > f.vh));
  expect(off.map((f) => f.fig)).toEqual([]);
  expect(errors).toEqual([]);
});
