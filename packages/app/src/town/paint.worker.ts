/**
 * A paint worker (paint-pool.ts): paints the loading screen's pictures handed to it with the main thread's own code (paint-jobs.ts
 * `paintBatch`, `paintSpec`) and sends each one's pixels back as it's done (their buffers handed over, not copied). The art it paints
 * from (a character, a box) comes once, by number, and is kept for the pictures after.
 */
import { paintBatch, type Batch } from "./paint-jobs.ts";

const defs = new Map<number, unknown>();
self.onmessage = (e: MessageEvent<Batch>) => paintBatch(defs, e.data, (r, transfer) => (self as unknown as Worker).postMessage(r, transfer));
