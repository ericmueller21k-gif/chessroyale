import * as S from "../../packages/app/src/town/street.ts";
import { lookalikeWith } from "../../packages/app/src/town/lookalike.ts";
const lots = (S as any).STREET_LOTS ?? (S as any).LOTS;
console.log(Object.keys(S).join(" "));
for (const l of lots ?? []) {
  if (l.kind !== "house" || l.facing !== "S") continue;
  const p = lookalikeWith(l.look).parts;
  console.log(l.street, "c0", l.c0, "r0", l.r0, "w", l.w, "at", JSON.stringify(l.at), "look", JSON.stringify(l.look), JSON.stringify(p));
}
