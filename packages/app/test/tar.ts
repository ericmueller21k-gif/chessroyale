import { gunzipSync } from "node:zlib";

/** A .tar.gz's files by path (ustar, with pax headers for long names). */
export function untar(gz: Uint8Array): Map<string, Buffer> {
  const tar = gunzipSync(gz);
  const files = new Map<string, Buffer>();
  let long: string | null = null;
  for (let at = 0; at + 512 <= tar.length; ) {
    const h = tar.subarray(at, at + 512);
    if (h.every((b) => b === 0)) break;
    const text = (from: number, n: number) => h.subarray(from, from + n).toString("utf8").replace(/\0[\s\S]*$/, "");
    const size = parseInt(text(124, 12), 8);
    const type = text(156, 1);
    const body = tar.subarray(at + 512, at + 512 + size);
    const prefix = text(345, 155);
    if (type === "x") long = /\d+ path=([^\n]*)\n/.exec(body.toString("utf8"))?.[1] ?? null;
    else if (type !== "g") {
      if (type === "0" || type === "") files.set(long ?? (prefix ? `${prefix}/${text(0, 100)}` : text(0, 100)), body);
      long = null;
    }
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}
