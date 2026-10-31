import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RANGED_ASSETS, parseRange, rangedAsset } from "../src/ranged.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The Colosseum's streamed ambience: the Worker answers Range requests the asset server answers whole (ranged.ts). */
const FILE = Uint8Array.from({ length: 100_000 }, (_, i) => i % 251);
/** An asset server that answers whole, in 4 KB chunks, counting how much was read. */
function assets() {
  const seen = { bytes: 0 };
  return {
    seen,
    fetch: async (r: Request) => {
      expect(r.headers.has("Range")).toBe(false);
      let at = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(c) {
          if (at >= FILE.length) return c.close();
          const chunk = FILE.subarray(at, at + 4096);
          at += chunk.length;
          seen.bytes = at;
          c.enqueue(chunk);
        },
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "audio/mpeg", ETag: '"x"' } });
    },
  };
}
const get = (range?: string) => new Request("https://hunchess.test/sounds/colosseum/ambient.mp3", { headers: range ? { Range: range } : {} });

describe("Range for the streamed ambience", () => {
  it("knows each file's size (the asset server doesn't say): run scripts/crowd-sounds.py again, then update RANGED_ASSETS", () => {
    for (const [path, size] of Object.entries(RANGED_ASSETS)) expect(statSync(join(ROOT, "packages/app/public", path)).size, path).toBe(size);
    expect(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8")).toContain('"/sounds/colosseum/ambient.mp3"]');
  });

  it("parses one bytes= range: from, from-to, the last N; anything else can't be served", () => {
    expect(parseRange("bytes=0-", 1000)).toEqual([0, 999]);
    expect(parseRange("bytes=10-19", 1000)).toEqual([10, 19]);
    expect(parseRange("bytes=990-5000", 1000)).toEqual([990, 999]);
    expect(parseRange("bytes=-100", 1000)).toEqual([900, 999]);
    for (const bad of ["bytes=1000-", "bytes=20-10", "bytes=-", "bytes=-0", "items=0-1", "bytes=0-1,5-6"]) expect(parseRange(bad, 1000), bad).toBeNull();
  });

  it("answers a range with 206 and exactly those bytes, reading the file only as far as the range's end", async () => {
    const a = assets();
    const res = await rangedAsset(get("bytes=50000-50999"), a, FILE.length);
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 50000-50999/100000");
    expect(res.headers.get("Content-Length")).toBe("1000");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(FILE.subarray(50000, 51000));
    expect(a.seen.bytes).toBeLessThan(60_000);
  });

  it("an open range runs to the end; no Range is the whole file (200); a range past the end is 416", async () => {
    const open = await rangedAsset(get("bytes=99000-"), assets(), FILE.length);
    expect(open.status).toBe(206);
    expect(new Uint8Array(await open.arrayBuffer())).toEqual(FILE.subarray(99000));
    const whole = await rangedAsset(get(), assets(), FILE.length);
    expect(whole.status).toBe(200);
    expect(whole.headers.get("Accept-Ranges")).toBe("bytes");
    expect(whole.headers.get("Content-Length")).toBe("100000");
    expect((await whole.arrayBuffer()).byteLength).toBe(FILE.length);
    const past = await rangedAsset(get("bytes=100000-"), assets(), FILE.length);
    expect(past.status).toBe(416);
    expect(past.headers.get("Content-Range")).toBe("bytes */100000");
  });
});
