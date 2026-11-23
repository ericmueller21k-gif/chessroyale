/**
 * HTTP Range for a static asset the asset server answers only whole: the Colosseum's hour of ambience
 * (packages/app/public/sounds/colosseum/ambient.mp3, about 18 MB), which the app streams with an <audio> element
 * starting at a random point in the hour. Without Range a phone would download everything before that point to start
 * there. The Worker asks the asset server for the whole file and passes on only the asked-for bytes (206), dropping the
 * bytes before them as they stream by and stopping after the last; it never holds the file in memory.
 */

/**
 * The paths served this way and each file's size in bytes: the asset server streams a file without its length, and a
 * player needs it to seek (a unit test checks each size against the file; wrangler.jsonc's `run_worker_first` lists the
 * paths too, so they reach the Worker).
 */
export const RANGED_ASSETS: Readonly<Record<string, number>> = { "/sounds/colosseum/ambient.mp3": 18_000_945 };

/** One `bytes=` range of a file `size` bytes long: [first, last] (inclusive), or null when it can't be served (416). */
export function parseRange(header: string, size: number): [number, number] | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "") || size <= 0) return null;
  if (m[1] === "") {
    // The last N bytes.
    const n = Number(m[2]);
    return n > 0 ? [Math.max(0, size - n), size - 1] : null;
  }
  const first = Number(m[1]);
  const last = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  return first < size && first <= last ? [first, last] : null;
}

/** The bytes [from, to) of a stream, read only as far as `to`. */
export function sliceStream(body: ReadableStream<Uint8Array>, from: number, to: number): ReadableStream<Uint8Array> {
  let at = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, out) {
        const a = Math.max(from - at, 0);
        const b = Math.min(to - at, chunk.length);
        at += chunk.length;
        if (b > a) out.enqueue(a === 0 && b === chunk.length ? chunk : chunk.subarray(a, b));
        if (at >= to) out.terminate();
      },
    }),
  );
}

/** The asset, as the asset server gives it, cut to the request's Range (206, or 416 for a range it can't serve). */
export async function rangedAsset(request: Request, assets: { fetch: (r: Request) => Promise<Response> }, size: number): Promise<Response> {
  const range = request.headers.get("Range");
  const plain = new Headers(request.headers);
  plain.delete("Range");
  const res = await assets.fetch(new Request(request.url, { method: request.method, headers: plain }));
  const headers = new Headers(res.headers);
  headers.set("Accept-Ranges", "bytes");
  if (res.status === 200) headers.set("Content-Length", String(size));
  if (!range || res.status !== 200 || !res.body) return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  const r = parseRange(range, size);
  if (!r) {
    await res.body.cancel();
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } });
  }
  const [first, last] = r;
  headers.set("Content-Range", `bytes ${first}-${last}/${size}`);
  headers.set("Content-Length", String(last - first + 1));
  let body = sliceStream(res.body, first, last + 1);
  // On Cloudflare, a stream of known length, so the reply carries its Content-Length (Safari's player wants it). (A
  // player that stops reading, as one does on a seek or a pause, ends the pipe: nothing to report.)
  const Fixed = (globalThis as { FixedLengthStream?: new (n: number) => TransformStream<Uint8Array, Uint8Array> }).FixedLengthStream;
  if (Fixed) {
    const fixed = new Fixed(last - first + 1);
    body.pipeTo(fixed.writable).catch(() => undefined);
    body = fixed.readable;
  }
  return new Response(body, { status: 206, headers });
}
