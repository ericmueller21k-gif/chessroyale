// MOCKUP ONLY: the boards' colors as a table for NOTE.md. npx tsx scripts/town-shop-mockup/table.ts
import { SKINS } from "../../packages/app/src/dev/town-shop-skins.ts";
console.log("| Board | Light | Dark | Frame (band, metal, motif) | Last move | Dots and picked square |");
console.log("|---|---|---|---|---|---|");
for (const s of SKINS) console.log(`| ${s.name} | \`${s.light}\` | \`${s.dark}\` | ${s.frame ? `\`${s.frame.deep}\`, \`${s.frame.metal}\`, ${s.frame.motif}` : "none"} | \`${s.last}\` | \`${s.dot}\` |`);
