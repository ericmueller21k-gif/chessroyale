import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { untar } from "./tar.ts";

/**
 * The PyChess sounds' source, served with the game (/sounds/pychess-sounds-source.tar.gz, GPL-3.0; DECISIONS.md, "The
 * PyChess sounds' source on the site"): written by scripts/sounds-source.py, it must hold the script that makes the
 * variations as it is now, the classics the game serves, PyChess's original WAVs and the license.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const SOUNDS = join(ROOT, "packages/app/public/sounds");
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

describe("the PyChess sounds' source archive", () => {
  const files = untar(readFileSync(join(SOUNDS, "pychess-sounds-source.tar.gz")));
  const file = (path: string) => files.get(`pychess-sounds-source/${path}`);

  it("holds scripts/piece-sounds.py as it is now (run scripts/sounds-source.py after changing it)", () => {
    expect(file("scripts/piece-sounds.py")?.equals(readFileSync(join(ROOT, "scripts/piece-sounds.py")))).toBe(true);
  });

  it("holds the classic sounds the game serves, the license and PyChess's original WAVs as its README lists them", () => {
    for (const name of ["move.mp3", "capture.mp3", "castle.mp3"]) {
      expect(file(`packages/app/public/sounds/${name}`)?.equals(readFileSync(join(SOUNDS, name))), name).toBe(true);
    }
    expect(file("COPYING.txt")?.toString()).toContain("GNU GENERAL PUBLIC LICENSE");
    const readme = file("README.txt")!.toString();
    for (const name of ["mov2.wav", "capture2.wav", "castle.wav"]) {
      const wav = file(`pychess/${name}`)!;
      expect(wav.subarray(0, 4).toString(), name).toBe("RIFF");
      expect(readme).toContain(`${name}  sha256 ${sha256(wav)}`);
    }
  });

  it("is linked wherever the sounds are credited", () => {
    const link = "/sounds/pychess-sounds-source.tar.gz";
    expect(readFileSync(join(ROOT, "packages/app/src/screens/Settings.tsx"), "utf8")).toContain(link);
    expect(readFileSync(join(ROOT, "packages/app/src/faq/content.ts"), "utf8")).toContain(link);
    expect(readFileSync(join(ROOT, "packages/app/public/licenses/third-party.txt"), "utf8")).toContain(link);
    expect(readFileSync(join(SOUNDS, "SOURCES.md"), "utf8")).toContain(link);
  });
});
