// The e2e server's request that the dev proxy dropped is sent again, whatever its method (Nov 14, flaky round 6).
//
// `wrangler dev` runs our Worker behind its own ProxyWorker (node_modules/wrangler/wrangler-dist/ProxyWorker.js), which reaches the
// Worker over a local connection. Now and then that connection drops ("Network connection lost"): wrangler sends a GET or a HEAD again
// ("recovered on attempt 2 after a dropped connection to the UserWorker", about once a shard), but answers any other request with a
// 500. The town's beat (POST /api/town/here, every 5 s on every signed-in page in the town) is most of the POSTs a test makes, so it
// was most of those 500s: a "Failed to load resource: … 500" in the console failed town.spec:1165 and town-street:174 on main
// (runs 43625203937 and 43628734675), Meadow Street (town-street:155) and the Colosseum (main run 1216) before. The game was right
// (a failed beat is dropped and the next one goes); production has no such proxy. So the dev proxy is fixed, not the tests' error
// checks: a dropped connection is tried again for any method, the request's body copied for each try (`request.clone()`), as wrangler
// already does for a GET. Run before `wrangler dev` (playwright.config.ts); a wrangler whose proxy reads otherwise stops the run here,
// so an upgrade can't drop this unseen.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const file = join(dirname(createRequire(import.meta.url).resolve("wrangler/package.json")), "wrangler-dist", "ProxyWorker.js");
const MARK = "/* e2e: dev-proxy-retry */";
let src = readFileSync(file, "utf8");
if (!src.includes(MARK)) {
  const swaps = [
    // Each try sends its own copy of the request (a body can be read once).
    ["void fetch(userWorkerUrl, new Request(request, { headers }))", `void fetch(userWorkerUrl, new Request(request.clone(), { headers })) ${MARK}`],
    // A dropped connection is tried again whatever the method (wrangler: GET and HEAD only).
    ['&& (request.method === "GET" || request.method === "HEAD") && attempt < 2', "&& attempt < 2"],
  ];
  for (const [from, to] of swaps) {
    if (src.split(from).length !== 2) {
      console.error(`e2e/dev-proxy-retry.mjs: wrangler's ProxyWorker.js no longer reads as expected (${JSON.stringify(from)}); update this script for the new wrangler.`);
      process.exit(1);
    }
    src = src.replace(from, to);
  }
  writeFileSync(file, src);
}
