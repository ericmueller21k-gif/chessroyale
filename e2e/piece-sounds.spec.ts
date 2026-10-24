import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";
import { CAPTURE_SOUNDS, CASTLE_SOUND, MOVE_SOUNDS } from "../packages/app/src/piece-sounds.ts";

/**
 * Settings → Sound: the Move sound and Capture sound pickers (Eric, Oct 11; all wood, Oct 12), and the Reveal sound
 * beside them (Oct 15). The classic knocks (PyChess's) by default, then their variations and the other wood; ▶ plays
 * one without picking it (loading only that file); a pick is kept on the device; the first tap (as a game starts)
 * loads only the picked sounds; every option's file decodes in the browser, starts on its hit and is as loud as the
 * classic; and the classics are credited. Each list is collapsed until a tap on its title row (Oct 24).
 */
test.use({ serviceWorkers: "block" }); // (the service worker would precache every file, hiding what the app loads)

/** The piece sounds requested: the classics (sounds/*.mp3) and the rest (sounds/pieces/). */
const pieceFiles = (urls: string[]) => [...new Set(urls.filter((u) => /\/sounds\/(pieces\/)?[^/]+\.mp3$/.test(new URL(u).pathname)).map((u) => new URL(u).pathname))].sort();

/** Opens one sound block by its title row (a tap only if it's still collapsed, so a repeat call doesn't close it). */
async function openSound(page: Page, title: string) {
  const head = page.getByRole("button", { name: title });
  if ((await head.getAttribute("aria-expanded")) !== "true") await head.click();
  await expect(head).toHaveAttribute("aria-expanded", "true");
}

test("piece sounds: pick a move and a capture sound, hear one, and they're kept after a reload", async ({ page }) => {
  await page.addInitScript(() => ((window as any).__soundLog = []));
  const requested: string[] = [];
  page.on("request", (r) => requested.push(r.url()));
  await page.goto("/settings?debug");
  // Nothing loaded before a tap (the first tap of a visit loads the picked sounds and the classics: see below).
  expect(pieceFiles(requested)).toEqual([]);
  await openSound(page, "Move sound");
  await openSound(page, "Capture sound");
  const move = page.getByRole("radiogroup", { name: "Move sound" });
  const capture = page.getByRole("radiogroup", { name: "Capture sound" });
  await expect(move.getByRole("radio")).toHaveCount(9);
  await expect(capture.getByRole("radio")).toHaveCount(9);
  // The classics until you pick.
  await expect(move.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Classic knock/);
  await expect(capture.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Classic double knock/);
  // The classic first, its three variations next, then the other wood (Eric, Oct 12).
  const names = (g: typeof move) => g.getByRole("radio").locator("strong").allTextContents();
  expect(await names(move)).toEqual(MOVE_SOUNDS.map((o) => o.label));
  expect(await names(capture)).toEqual(CAPTURE_SOUNDS.map((o) => o.label));
  for (const name of await move.getByRole("radio").allTextContents()) expect(name).toMatch(/wood|knock|classic/i);
  for (const name of await capture.getByRole("radio").allTextContents()) expect(name).toMatch(/wood|knock|classic/i);

  // ▶ plays one without picking it: its file loads then.
  const ringing = page.waitForResponse((r) => r.url().endsWith("/sounds/pieces/move-ringing-wood.mp3") && r.ok());
  await page.getByRole("button", { name: "Play Ringing wood" }).click();
  await ringing;
  await expect(move.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Classic knock/);

  // Pick one of each (picking plays it too).
  await move.getByRole("radio", { name: /^Wooden tap/ }).click();
  await capture.getByRole("radio", { name: /^Double knock/ }).click();
  await expect(move.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Wooden tap/);
  await expect(capture.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Double knock/);
  expect(await page.evaluate(() => (window as any).__soundLog)).toEqual(["preview:move:ringing-wood", "preview:move:wood-tap", "preview:capture:double-knock"]);

  // Kept on the device: the same after a reload.
  requested.length = 0;
  await page.reload();
  // (Opening the lists is the first tap of this visit: it loads the picked sounds, the classics and castling's classic knock.)
  await openSound(page, "Move sound");
  await openSound(page, "Capture sound");
  await expect(page.getByRole("radiogroup", { name: "Move sound" }).getByRole("radio", { checked: true })).toHaveAccessibleName(/^Wooden tap/);
  await expect(page.getByRole("radiogroup", { name: "Capture sound" }).getByRole("radio", { checked: true })).toHaveAccessibleName(/^Double knock/);
  expect(await page.evaluate(() => [localStorage.getItem("brc.moveSound"), localStorage.getItem("brc.captureSound")])).toEqual(["wood-tap", "double-knock"]);

  // The first tap loads the picked sounds, the classics (the defaults: the judge's gavel is built from them) and
  // castling's classic knock, not the other options; ▶ then loads the one it plays.
  await page.getByRole("button", { name: "Play Big wood" }).click();
  await expect
    .poll(() => pieceFiles(requested), { timeout: 10_000 })
    .toEqual(["/sounds/capture.mp3", "/sounds/castle.mp3", "/sounds/move.mp3", "/sounds/pieces/capture-big-wood.mp3", "/sounds/pieces/capture-double-knock.mp3", "/sounds/pieces/move-wood-tap.mp3"]);

  // A move in a game plays the pick: "move", rendered as the game plays it, is the classic with that picked, and the
  // Wooden tap once it's picked (and loaded: until then the default stands in).
  const level = (n: string) => page.evaluate((n) => (window as any).__measureSound(n), n) as Promise<{ peak: number; rms: number }>;
  // (The hook is put on `window` once the app knows test switches are allowed, which it learns a moment after the reload:
  // on a slow phone, after the taps above. Wait for it.)
  await page.waitForFunction(() => typeof (window as any).__measureSound === "function", null, { timeout: 10_000 });
  const moves = page.getByRole("radiogroup", { name: "Move sound" });
  await moves.getByRole("radio", { name: /^Classic knock/ }).click();
  await expect.poll(async () => (await level("move")).peak, { timeout: 10_000 }).toBeGreaterThan(0.05);
  const classic = await level("move");
  // Castling with the default: the classic king-and-rook knock, its own file (not the classic move twice).
  await expect.poll(async () => (await level("castle")).peak, { timeout: 10_000 }).toBeGreaterThan(0.05);
  const castle = await level("castle");
  await moves.getByRole("radio", { name: /^Wooden tap/ }).click();
  // (Every option is leveled to the same loudness, so their peaks are close, but not the same: the Wooden tap's
  // differs from the classic's, rendered the same way each time.)
  await expect.poll(async () => Math.abs((await level("move")).peak - classic.peak), { timeout: 10_000 }).toBeGreaterThan(0.02);
  // Castling follows the pick too: two Wooden taps (the first's peak), no longer the classic castle.
  const tap = await level("move");
  expect(Math.abs((await level("castle")).peak - tap.peak)).toBeLessThan(0.01);
  expect(Math.abs((await level("castle")).peak - castle.peak)).toBeGreaterThan(0.01);
  // A variation of the classic plays as picked, too.
  await moves.getByRole("radio", { name: /^Classic deep/ }).click();
  await expect.poll(async () => Math.abs((await level("move")).peak - tap.peak), { timeout: 10_000 }).toBeGreaterThan(0.01);
});

test("piece sounds: each Sound list is collapsed when Settings opens, a tap opens it with every ▶, and it's collapsed again after a reload or a visit elsewhere", async ({ page }) => {
  await page.goto("/settings");
  const lists = [
    { title: "Move sound", pick: "Classic knock", count: 9 },
    { title: "Capture sound", pick: "Classic double knock", count: 9 },
    { title: "Reveal sound", pick: "Steel pan", count: 6 },
  ];
  const head = (title: string) => page.getByRole("button", { name: title });
  // Collapsed when Settings opens: the title row shows the current pick's name, and no option is in the page.
  for (const { title, pick } of lists) {
    await expect(head(title)).toHaveAttribute("aria-expanded", "false");
    await expect(head(title)).toContainText(pick);
    await expect(page.getByRole("radiogroup", { name: title })).toHaveCount(0);
  }
  // A tap on the title row opens its list: every option, each with its ▶. The blocks open on their own.
  for (const { title, count } of lists) {
    await head(title).click();
    await expect(head(title)).toHaveAttribute("aria-expanded", "true");
    const group = page.getByRole("radiogroup", { name: title });
    await expect(group.getByRole("radio")).toHaveCount(count);
    await expect(group.getByRole("button", { name: /^Play / })).toHaveCount(count);
  }
  // A tap on an open title row closes it; the others stay open.
  const move = page.getByRole("radiogroup", { name: "Move sound" });
  await head("Move sound").click();
  await expect(head("Move sound")).toHaveAttribute("aria-expanded", "false");
  await expect(move).toHaveCount(0);
  await expect(head("Capture sound")).toHaveAttribute("aria-expanded", "true");
  await head("Move sound").click();
  // A pick keeps its list open, shows its name on the title row, and is kept after a reload (collapsed again then).
  await move.getByRole("radio", { name: /^Wooden tap/ }).click();
  await expect(move.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Wooden tap/);
  await expect(head("Move sound")).toHaveAttribute("aria-expanded", "true");
  await expect(head("Move sound")).toContainText("Wooden tap");
  await page.reload();
  await expect(head("Move sound")).toHaveAttribute("aria-expanded", "false");
  await expect(head("Move sound")).toContainText("Wooden tap");
  await expect(move).toHaveCount(0);
  await head("Move sound").click();
  await expect(move.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Wooden tap/);
  // Leaving Settings and coming back: all collapsed again, the pick kept.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  for (const { title } of lists) await expect(head(title)).toHaveAttribute("aria-expanded", "false");
  await expect(head("Move sound")).toContainText("Wooden tap");
  await expect(move).toHaveCount(0);
});

test("piece sounds: the classics and their variations are credited to PyChess (GPL-3.0), with the license served", async ({ page }) => {
  await page.goto("/settings");
  const credit = page.locator(".sounds-credit");
  await expect(credit).toContainText("Classic piece sounds and their variations: PyChess (GPL-3.0)");
  await expect(credit.getByRole("link", { name: "PyChess" })).toHaveAttribute("href", "https://github.com/pychess/pychess/tree/master/sounds");
  await expect(credit.getByRole("link", { name: "license" })).toHaveAttribute("href", "/engine/COPYING.txt");
  for (const [path, text] of [
    ["/engine/COPYING.txt", "GNU GENERAL PUBLIC LICENSE"],
    ["/licenses/third-party.txt", "variations of\n  PyChess's sounds, made by our script"],
    ["/sounds/SOURCES.md", "A variation of PyChess's sounds, made by our script"],
  ] as const) {
    const r = await page.request.get(path);
    expect(r.ok(), path).toBe(true);
    expect(await r.text(), path).toContain(text);
  }
  // The FAQ's credits say the same.
  await page.goto("/faq#credits");
  const faq = page.locator("li", { hasText: "Classic piece sounds and their variations: PyChess (GPL-3.0)." });
  await expect(faq).toHaveCount(1);
  await expect(faq.getByRole("link", { name: "PyChess" })).toHaveAttribute("href", "https://github.com/pychess/pychess/tree/master/sounds");
  await expect(faq.getByRole("link", { name: "license" })).toHaveAttribute("href", "/engine/COPYING.txt");
});

test("piece sounds: every option decodes, starts on its hit and is as loud as the classic", async ({ page }) => {
  await page.goto("/settings");
  const paths = [...MOVE_SOUNDS, ...CAPTURE_SOUNDS].map((o) => o.file);
  expect(paths).toHaveLength(18);
  paths.push(CASTLE_SOUND);
  // Decoded by the browser (an mp3's padding included) and heard as a phone plays it in the game (high-passed at
  // 200 Hz, the game's 6 kHz low-pass): the loudest 30 ms, against the classic move or capture. (Castling's classic
  // file too, against the move.)
  const measured = await page.evaluate(async (paths) => {
    const out: Record<string, { seconds: number; peak: number; onsetMs: number; loud: number }> = {};
    for (const p of paths) {
      const bytes = await (await fetch(p)).arrayBuffer();
      const buf = await new OfflineAudioContext(1, 44100, 44100).decodeAudioData(bytes);
      const x = buf.getChannelData(0);
      let peak = 0;
      for (const v of x) peak = Math.max(peak, Math.abs(v));
      const onset = x.findIndex((v) => Math.abs(v) > peak * 0.1);
      const off = new OfflineAudioContext(1, buf.length, buf.sampleRate);
      const src = off.createBufferSource();
      src.buffer = buf;
      const hp = off.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 200;
      // (Web Audio reads a low- or high-pass's Q in dB: -3.01 dB is the script's Q of 0.707, so this measures what
      // scripts/piece-sounds.py levels. The default, 1 dB, adds a bump at 200 Hz that reads low wood ~2 dB louder.)
      hp.Q.value = 20 * Math.log10(Math.SQRT1_2);
      const lp = off.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 6000;
      lp.Q.value = 20 * Math.log10(Math.SQRT1_2);
      src.connect(hp).connect(lp).connect(off.destination);
      src.start(0);
      const y = (await off.startRendering()).getChannelData(0);
      const w = Math.round(0.03 * buf.sampleRate);
      let best = 0;
      let sum = 0;
      for (let i = 0; i < y.length; i++) {
        sum += y[i]! * y[i]!;
        if (i >= w) sum -= y[i - w]! * y[i - w]!;
        best = Math.max(best, sum / w);
      }
      out[p] = { seconds: buf.duration, peak: 20 * Math.log10(peak), onsetMs: (onset / buf.sampleRate) * 1000, loud: 10 * Math.log10(best) };
    }
    return out;
  }, paths);
  const ref = { move: measured[MOVE_SOUNDS[0].file]!, capture: measured[CAPTURE_SOUNDS[0].file]! };
  for (const [path, m] of Object.entries(measured)) {
    const r = path.includes("capture") ? ref.capture : ref.move;
    expect(m.seconds, path).toBeLessThan(0.5);
    expect(m.peak, path).toBeLessThan(-1);
    // On its hit as soon as the classic is.
    expect(m.onsetMs, path).toBeLessThan(r.onsetMs + 5);
    // As loud as the classic, within a decibel (the classic's variations within half a decibel: they measure 0.1 off).
    expect(Math.abs(m.loud - r.loud), path).toBeLessThan(path.includes("-classic-") ? 0.5 : 1);
  }
});

test("the reveal sound (Settings → Sound, beside the piece sounds): the steel pan until you pick; ▶ plays a whole roulette without picking; a pick is kept", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto("/settings");
  await openSound(page, "Reveal sound");
  const reveal = page.getByRole("radiogroup", { name: "Reveal sound" });
  expect(await reveal.getByRole("radio").locator("strong").allTextContents()).toEqual(["Steel pan", "Kalimba", "Marimba", "Glockenspiel", "Music box", "8-bit blip"]);
  await expect(reveal.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Steel pan/);
  // ▶: the roulette's slowing steps, then the winner's tones; nothing picked.
  await page.getByRole("button", { name: "Play Kalimba" }).click();
  const log = () => page.evaluate(() => (window as any).__soundLog as string[]);
  await expect.poll(async () => (await log()).filter((x) => x.startsWith("select:")).length, { timeout: 5000 }).toBe(1);
  expect((await log()).filter((x) => x.startsWith("reel:"))).toHaveLength(11);
  await expect(reveal.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Steel pan/);
  // A pick (it plays too), kept on the device.
  await reveal.getByRole("radio", { name: /^Marimba/ }).click();
  await page.reload();
  await openSound(page, "Reveal sound");
  await expect(page.getByRole("radiogroup", { name: "Reveal sound" }).getByRole("radio", { checked: true })).toHaveAccessibleName(/^Marimba/);
  expect(await page.evaluate(() => localStorage.getItem("brc.reelVoice"))).toBe("marimba");
});
