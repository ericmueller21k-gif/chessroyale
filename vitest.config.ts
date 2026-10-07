import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["packages/*/test/**/*.test.ts"] },
  // The Durable Object base class, for unit tests of the server's objects (the Worker runtime provides the real one).
  resolve: { alias: { "cloudflare:workers": fileURLToPath(new URL("./packages/server/test/cloudflare-workers.ts", import.meta.url)) } },
});
