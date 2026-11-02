import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The Colosseum's sounds (sounds/colosseum/, made by scripts/crowd-sounds.py; docs/areas/colosseum.md): the hour of
 * ambience is streamed, so it must stay a small constant-bitrate file the service worker leaves alone, and the cheer's
 * CC BY credit must show where the game's other sound credits do.
 */
const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const COL = join(APP, "public/sounds/colosseum");
const read = (p: string) => readFileSync(join(APP, p), "utf8");

/** The MPEG audio frames after the ID3 tag: the first (LAME's Info frame, for a constant bitrate) and the audio frame after it. */
function frames(b: Buffer) {
  let i = 0;
  if (b.subarray(0, 3).toString() === "ID3") i = 10 + ((b[6]! << 21) | (b[7]! << 14) | (b[8]! << 7) | b[9]!);
  const tag = i;
  while (!(b[i] === 0xff && (b[i + 1]! & 0xe0) === 0xe0)) i++;
  const header = (i: number) => {
    const mpeg2 = ((b[i + 1]! >> 3) & 3) === 2;
    const kbps = (mpeg2 ? [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] : [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320])[b[i + 2]! >> 4]!;
    const rate = (mpeg2 ? [22050, 24000, 16000] : [44100, 48000, 32000])[(b[i + 2]! >> 2) & 3]!;
    const size = Math.floor(((mpeg2 ? 72 : 144) * kbps * 1000) / rate) + ((b[i + 2]! >> 1) & 1);
    return { kbps, rate, mono: b[i + 3]! >> 6 === 3, size };
  };
  const first = header(i);
  const audio = header(i + first.size);
  return { tag, info: b.subarray(i, i + first.size).includes("Info"), kbps: audio.kbps, rate: audio.rate, mono: audio.mono };
}

describe("the Colosseum's sounds", () => {
  it("the hour of ambience: mono, 22.05 kHz, 40 kb/s constant (a Range request starts it anywhere), no cover image, under Cloudflare's 25 MiB", () => {
    const f = join(COL, "ambient.mp3");
    const b = readFileSync(f);
    const h = frames(b);
    expect(h).toMatchObject({ kbps: 40, rate: 22050, mono: true, info: true });
    expect(h.tag, "no cover image in its tag").toBeLessThan(1024);
    const mb = statSync(f).size / 1e6;
    expect(mb).toBeGreaterThan(17);
    expect(mb).toBeLessThan(19);
    expect(statSync(f).size).toBeLessThan(25 * 1024 * 1024);
    // (Its size is also in packages/server/src/ranged.ts, RANGED_ASSETS: the Worker answers its Range requests.)
  });

  it("the service worker neither precaches the hour nor answers for it (the browser streams it from the network)", () => {
    expect(read("vite.config.ts")).toContain('f !== "/sounds/colosseum/ambient.mp3"');
    const sw = read("sw-template.js");
    expect(sw).toContain('const STREAMED = ["/sounds/colosseum/ambient.mp3"]');
    expect(sw).toContain("STREAMED.includes(url.pathname)) return;");
    expect(read("src/colosseum/ambient.ts")).toContain('AMBIENT_URL = "/sounds/colosseum/ambient.mp3"');
  });

  it("the cheer (CC BY 4.0) is credited in Settings, the FAQ, the notice and its CREDITS.md", () => {
    const q = "https://opengameart.org/content/free-crowd-cheering-sounds";
    expect(read("src/screens/Settings.tsx")).toContain(`The Colosseum's crowd cheer: <a href="${q}">Free Crowd Cheering Sounds</a> by Gregor Quendel`);
    expect(read("src/faq/content.ts")).toContain(`- **The Colosseum's crowd cheer**: [Free Crowd Cheering Sounds](${q}) by Gregor Quendel, under [CC BY 4.0]`);
    expect(read("public/licenses/third-party.txt")).toContain(q);
    const credits = read("public/sounds/colosseum/CREDITS.md");
    expect(credits).toContain("Gladiator arena ambience, royalty free, supplied by Eric");
    expect(credits).toContain("licensed CC BY 4.0");
    expect(statSync(join(COL, "cheer.mp3")).size).toBeLessThan(60_000);
  });
});
