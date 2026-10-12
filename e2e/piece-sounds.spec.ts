import { expect } from "@playwright/test";
import { test } from "./helpers.ts";
import { CAPTURE_SOUNDS, MOVE_SOUNDS } from "../packages/app/src/piece-sounds.ts";

/**
 * Settings → Sound: the Move sound and Capture sound pickers (Eric, Oct 11; all wood, Oct 12). Light wood and Heavy
 * wood by default; ▶ plays one
 * without picking it (loading only that file); a pick is kept on the device; the first tap (as a game starts) loads only
 * the picked sounds; and every option's file decodes in the browser, starts on its hit and is as loud as the default.
 */
test.use({ serviceWorkers: "block" }); // (the service worker would precache every file, hiding what the app loads)

const pieceFiles = (urls: string[]) => [...new Set(urls.filter((u) => /\/sounds\/pieces\//.test(u)).map((u) => new URL(u).pathname))].sort();

test("piece sounds: pick a move and a capture sound, hear one, and they're kept after a reload", async ({ page }) => {
  await page.addInitScript(() => ((window as any).__soundLog = []));
  const requested: string[] = [];
  page.on("request", (r) => requested.push(r.url()));
  await page.goto("/settings?debug");
  const move = page.getByRole("radiogroup", { name: "Move sound" });
  const capture = page.getByRole("radiogroup", { name: "Capture sound" });
  await expect(move.getByRole("radio")).toHaveCount(5);
  await expect(capture.getByRole("radio")).toHaveCount(5);
  // The defaults until you pick, and nothing loaded before a tap.
  await expect(move.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Light wood/);
  await expect(capture.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Heavy wood/);
  expect(pieceFiles(requested)).toEqual([]);
  // Every option is wood (Eric, Oct 12).
  for (const name of await move.getByRole("radio").allTextContents()) expect(name).toMatch(/wood/i);
  for (const name of await capture.getByRole("radio").allTextContents()) expect(name).toMatch(/wood|knock/i);

  // ▶ plays one without picking it: its file loads then.
  const ringing = page.waitForResponse((r) => r.url().endsWith("/sounds/pieces/move-ringing-wood.mp3") && r.ok());
  await page.getByRole("button", { name: "Play Ringing wood" }).click();
  await ringing;
  await expect(move.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Light wood/);

  // Pick one of each (picking plays it too).
  await move.getByRole("radio", { name: /^Wooden tap/ }).click();
  await capture.getByRole("radio", { name: /^Double knock/ }).click();
  await expect(move.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Wooden tap/);
  await expect(capture.getByRole("radio", { checked: true })).toHaveAccessibleName(/^Double knock/);
  expect(await page.evaluate(() => (window as any).__soundLog)).toEqual(["preview:move:ringing-wood", "preview:move:wood-tap", "preview:capture:double-knock"]);

  // Kept on the device: the same after a reload.
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "Move sound" }).getByRole("radio", { checked: true })).toHaveAccessibleName(/^Wooden tap/);
  await expect(page.getByRole("radiogroup", { name: "Capture sound" }).getByRole("radio", { checked: true })).toHaveAccessibleName(/^Double knock/);
  expect(await page.evaluate(() => [localStorage.getItem("brc.moveSound"), localStorage.getItem("brc.captureSound")])).toEqual(["wood-tap", "double-knock"]);

  // The first tap loads the picked sounds, the defaults (the judge's gavel is built from them) and castling's two
  // knocks, not the other options.
  requested.length = 0;
  await page.getByRole("button", { name: "Play Big wood" }).click();
  await expect
    .poll(() => pieceFiles(requested), { timeout: 10_000 })
    .toEqual(["capture-big-wood", "capture-double-knock", "capture-heavy-wood", "castle-wood", "move-light-wood", "move-wood-tap"].map((p) => `/sounds/pieces/${p}.mp3`));

  // A move in a game plays the pick: "move", rendered as the game plays it, is the Light wood with that picked, and the
  // Wooden tap once it's picked (and loaded: until then the default stands in).
  const level = (n: string) => page.evaluate((n) => (window as any).__measureSound(n), n) as Promise<{ peak: number; rms: number }>;
  const moves = page.getByRole("radiogroup", { name: "Move sound" });
  await moves.getByRole("radio", { name: /^Light wood/ }).click();
  await expect.poll(async () => (await level("move")).peak, { timeout: 10_000 }).toBeGreaterThan(0.05);
  const wood = await level("move");
  // Castling with the default: its own file, the Light wood twice (its loudest knock is the Light wood's).
  expect(Math.abs((await level("castle")).peak - wood.peak)).toBeLessThan(0.02);
  await moves.getByRole("radio", { name: /^Wooden tap/ }).click();
  // (Every option is levelled to the same loudness, so their peaks are close: the Wooden tap's is 0.04 off the Light
  // wood's, rendered the same way each time.)
  await expect.poll(async () => Math.abs((await level("move")).peak - wood.peak), { timeout: 10_000 }).toBeGreaterThan(0.02);
  // Castling follows the pick too: two Wooden taps.
  const tap = await level("move");
  expect(Math.abs((await level("castle")).peak - tap.peak)).toBeLessThan(0.01);
});

test("piece sounds: every option decodes, starts on its hit and is about as loud as the default", async ({ page }) => {
  await page.goto("/settings");
  const paths = [...MOVE_SOUNDS, ...CAPTURE_SOUNDS].map((o) => o.file);
  // Decoded by the browser (an mp3's padding included) and heard as a phone plays it in the game (high-passed at
  // 200 Hz, the game's 6 kHz low-pass): the loudest 30 ms, against today's move or capture.
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
      const lp = off.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 6000;
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
    // On its hit as soon as the default is.
    expect(m.onsetMs, path).toBeLessThan(r.onsetMs + 5);
    // As loud as the default, within a decibel or two.
    expect(Math.abs(m.loud - r.loud), path).toBeLessThan(2);
  }
});
