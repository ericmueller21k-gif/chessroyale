import { expect, type Page } from "@playwright/test";
import { asAdmin, test, townReady } from "./helpers.ts";

/**
 * Rolling Dough, Don Dough's bakery (Nov 11; docs/areas/town-square.md, "Inside a shop"), on a phone and a computer, as an admin (Don
 * Dough is in the game for admins first): walk in from the town; the two guards' `watch` follows you; the counter zebra's Talk has him
 * say a line; through the door at the back left into the back room (its own room) and out again; the chatter at the back table; and
 * the talk beat (the crew stand, draw and aim with Fedora's line, Don waves them down, they lower, his challenge line), his Challenge
 * greyed with "Coming soon" until his boss is in the game. ZEBRA_SHOTS=<dir>: the stills for the PR.
 * Test hooks: the room's canvas (`data-room`, `data-part`, `data-you`, `data-ready`), `__shopAt("keeper" | "pass" | "square")`,
 * `__shopZebra()` (who's drawn, their animation and frame, who's talking, the talk beat's step, the chatter's place, you).
 */
test.use({ actionTimeout: 15_000 });
const SHOTS = process.env.ZEBRA_SHOTS;
const ZEBRA_LINES = { draw: "Hey! Who let HIM back here?!", relax: "Relax, relax. Put the bread down." };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
});

const room = (p: Page) => p.locator("canvas.town-shop-canvas");
type Fig = { name: string; anim: string; frame: number; at: [number, number]; flip: boolean };
type Zebra = { part: string; figs: Fig[]; say: { who: string; text: string } | null; beat: string | null; chatter: { exchange: number; line: number } | null; you: [number, number] };
type Hooks = {
  __townAt?: (k: string, id: string) => { x: number; y: number } | null;
  __townGlide?: (to: string) => void;
  __shopAt?: (k: string, sq?: readonly [number, number]) => { x: number; y: number } | null;
  __shopLook?: (k: string) => boolean;
  __shopZebra?: () => Zebra | null;
};
const zebra = (p: Page) => p.evaluate(() => (window as unknown as Hooks).__shopZebra?.() ?? null);
async function shopAt(p: Page, kind: "keeper" | "pass" | "square", sq?: readonly [number, number]) {
  const xy = await p.evaluate(([k, s]) => (window as unknown as Hooks).__shopAt?.(k as string, s as [number, number] | undefined) ?? null, [kind, sq] as const);
  if (!xy) return null;
  const cv = (await room(p).boundingBox())!;
  return { x: cv.x + xy.x, y: cv.y + xy.y };
}
async function homeAt(p: Page) {
  const xy = await p.evaluate(() => (window as unknown as Hooks).__townAt?.("home", "zebra") ?? null);
  if (!xy) return null;
  const cv = (await p.locator("canvas.town-canvas").boundingBox())!;
  return { x: cv.x + xy.x, y: cv.y + xy.y };
}
/** The guard's `watch` frame for you at (x, y) (the art's rule, shop-zebra-nov10.md). */
const watchOf = (g: { at: [number, number]; face: number }, x: number, y: number) => {
  let dx = (x - g.at[0]) * g.face;
  if (y < g.at[1] - 1.5) dx -= 2;
  return Math.max(0, Math.min(4, 2 + Math.round(dx / 1.5)));
};
/** Taps a square until you stand on it (each tap once it's on screen). */
async function walkTo(p: Page, sq: readonly [number, number]) {
  await expect(async () => {
    const at = await shopAt(p, "square", sq);
    expect(at, `${sq} on screen`).not.toBeNull();
    await p.mouse.click(at!.x, at!.y);
    await expect(room(p)).toHaveAttribute("data-you", sq.join(","), { timeout: 6000 });
  }).toPass({ timeout: 30_000 });
}
/** Through the door between the rooms: a tap on it walks you there, its card's button takes you through. */
async function goThrough(p: Page, button: "Go in" | "Go out front", part: "back" | null) {
  const card = p.getByRole("dialog", { name: "Door", exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    if (!(await shopAt(p, "pass"))) {
      await p.evaluate(() => (window as unknown as Hooks).__shopLook?.("pass"));
      await p.waitForTimeout(300);
    }
    const at = await shopAt(p, "pass");
    expect(at, "the door on screen").not.toBeNull();
    await p.mouse.click(at!.x, at!.y);
    await expect(card).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  await expect(card.getByRole("button")).toHaveText([button]);
  await card.getByRole("button", { name: button }).click();
  if (part) await expect(room(p)).toHaveAttribute("data-part", part, { timeout: 20_000 });
  else await expect(room(p)).not.toHaveAttribute("data-part", /./, { timeout: 20_000 });
  await expect(room(p)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
}
const shot = async (p: Page, name: string) => SHOTS && (await p.screenshot({ path: `${SHOTS}/${name}-${test.info().project.name}.png` }));

test("Rolling Dough: in, the guards watch you, the counter zebra's line, through to the back room, the chatter, the talk beat, and back", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await asAdmin(page);
  await page.goto("/town?sky=day");
  await townReady(page);
  // The bakery stands in an admin's town; its card is its name and Go in.
  await page.evaluate(() => (window as unknown as Hooks).__townGlide?.("zebra"));
  await expect.poll(() => homeAt(page), { message: "the bakery comes into view" }).not.toBeNull();
  await page.waitForTimeout(1500);
  await shot(page, "outside");
  const card = page.getByRole("dialog", { name: "Rolling Dough", exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    const at = await homeAt(page);
    expect(at).not.toBeNull();
    await page.mouse.click(at!.x, at!.y);
    await expect(card).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  await expect(card.getByRole("button")).toHaveText(["Go in"]);
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  await expect(room(page)).toHaveAttribute("data-room", "zebra");
  await expect(page.getByRole("heading", { name: "Rolling Dough" })).toBeVisible();
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "day");

  // The guards by the door: each on his `watch` frame for where you stand, following you as you walk in past them.
  const G = [
    { name: "guard-a", at: [8, 17.2] as [number, number], face: 1 },
    { name: "guard-b", at: [11, 17.2] as [number, number], face: -1 },
  ];
  const guardsWatch = async () => {
    const z = (await zebra(page))!;
    return G.map((g) => {
      const f = z.figs.find((x) => x.name === g.name)!;
      return f.anim === "watch" && f.frame === watchOf(g, z.you[0], z.you[1]) ? f.frame : `${f.anim} ${f.frame} (want ${watchOf(g, z.you[0], z.you[1])})`;
    });
  };
  await page.waitForTimeout(600);
  await shot(page, "front-door");
  const seen = new Set<string>();
  const first = await guardsWatch();
  first.forEach((f) => expect(typeof f, String(f)).toBe("number"));
  seen.add(first.join(","));
  await walkTo(page, [10, 13]);
  await expect.poll(async () => (await guardsWatch()).every((f) => typeof f === "number"), { message: "they watch you there" }).toBe(true);
  seen.add((await guardsWatch()).join(","));
  expect(seen.size, "their look changed as you walked past them").toBeGreaterThan(1);
  await shot(page, "front");

  // The counter zebra: Talk has him say one of his lines (no crate yet).
  await expect.poll(() => shopAt(page, "keeper"), { message: "the counter zebra is drawn" }).not.toBeNull();
  const k = (await shopAt(page, "keeper"))!;
  await page.mouse.click(k.x, k.y);
  const keeper = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(keeper).toBeVisible({ timeout: 15_000 });
  await keeper.getByRole("button", { name: "Talk" }).click();
  await expect.poll(async () => (await zebra(page))?.say, { message: "he says a line" }).toMatchObject({ who: "keeper" });
  expect(["Rye, sourdough, or... the special box?", "Fresh today. Fresh every day. No questions."]).toContain((await zebra(page))!.say!.text);
  await page.keyboard.press("Escape");

  // Through the door at the back left: the back room, its own room (dim: the night tone).
  await goThrough(page, "Go in", "back");
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "night");
  await expect(room(page)).toHaveAttribute("data-you", "4,9");
  const back = (await zebra(page))!;
  expect(back.figs.map((f) => f.name).sort()).toEqual(["crew-c", "crew-d", "crew-e", "don"]);
  // The chatter: a line in a bubble within a few seconds, the speaker on his talking (or arguing, scoffing) loop, the rest listening.
  await expect.poll(async () => (await zebra(page))?.say?.who ?? null, { message: "someone at the table talks", timeout: 8000 }).not.toBeNull();
  const z1 = (await zebra(page))!;
  const speaker = z1.figs.find((f) => f.name === z1.say!.who)!;
  expect(["sitTalk", "sitArgue", "sitScoff"]).toContain(speaker.anim);
  for (const f of z1.figs.filter((x) => x.name !== z1.say!.who)) expect(["sitListen", "sitPuff"]).toContain(f.anim);
  await shot(page, "back");

  // The talk beat: walk up to the table's foot, his card (Talk; Challenge greyed); Talk.
  await walkTo(page, [8, 7]);
  const don = page.getByRole("dialog", { name: "Don Dough", exact: true });
  await expect(don).toBeVisible({ timeout: 15_000 });
  await expect(don.getByRole("button")).toHaveText(["Talk", "Challenge"]);
  await expect(don.getByRole("button", { name: "Challenge" })).toBeDisabled();
  await don.getByRole("button", { name: "Talk" }).click();
  // (His card steps aside so the beat shows; it comes back as the beat ends.)
  await expect(don).toBeHidden();
  const steps: string[] = [];
  const lines: string[] = [];
  const anims = new Set<string>();
  const shotsTaken = new Set<string>();
  await expect
    .poll(
      async () => {
        const z = (await zebra(page))!;
        if (z.beat && steps[steps.length - 1] !== z.beat) steps.push(z.beat);
        if (z.say && lines[lines.length - 1] !== z.say.text) lines.push(z.say.text);
        for (const f of z.figs) if (f.name !== "don") anims.add(f.anim);
        // (The stills: the crew aiming with Fedora's line; Don waving them down with his.)
        const still = z.say?.text === ZEBRA_LINES.draw ? "talk-aim" : z.say?.text === ZEBRA_LINES.relax ? "talk-relax" : null;
        if (SHOTS && still && !shotsTaken.has(still)) {
          shotsTaken.add(still);
          await shot(page, still);
        }
        return z.beat;
      },
      { message: "the talk beat plays through", timeout: 30_000, intervals: [100] },
    )
    .toBe("done");
  expect(steps).toEqual(["stand", "draw", "aim", "relax", "lower", "challenge", "done"]);
  expect(lines).toEqual(["Hey! Who let HIM back here?!", "Relax, relax. Put the bread down.", "So. You came to play, or to watch the stream?"]);
  for (const a of ["standUp", "draw", "aim", "lower", "puff"]) expect([...anims], a).toContain(a);
  // His card again: Talk done (greyed); his boss isn't in the game yet, so Challenge stays greyed, with why under it.
  await expect(don).toBeVisible();
  await expect(don.getByRole("button", { name: "Talk" })).toBeDisabled();
  await expect(don.getByRole("button", { name: "Challenge" })).toBeDisabled();
  await expect(don).toContainText("Coming soon");
  await shot(page, "talk-done");
  await page.keyboard.press("Escape");

  // Back out front: you arrive just inside the back door.
  await goThrough(page, "Go out front", null);
  await expect(room(page)).toHaveAttribute("data-you", "4,7");
  expect(errors).toEqual([]);
});
