// Writes packages/app/src/characters/portraits.gen.ts (each boss's portrait as pixels, for the first load): run after a change to a
// boss's drawing or portrait. `npx tsx packages/app/scripts/portraits.ts`
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { portraitsSource } from "../test/portraits-make.ts";

const out = fileURLToPath(new URL("../src/characters/portraits.gen.ts", import.meta.url));
writeFileSync(out, portraitsSource());
console.log(`wrote ${out}`);
