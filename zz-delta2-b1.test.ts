import { it } from "vitest";
import { JUDGES } from "@chessroyale/core";
import { drawJudges, type JudgeCandidate } from "../src/judges.ts";
type K = "computer" | "phone";
const mk = (n: number, nps: number, kind: K, p: string): JudgeCandidate[] => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}`, nps, owner: `${p}${i}`, kind }));
const atk = (n: number, nps: number, kind: K) => Array.from({ length: n }, (_, i) => ({ id: `A${i}`, nps, owner: `A${i}`, kind }));
it("delta2 table", () => {
  let s = 7; const rng = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const N = 20000;
  const row = (name: string, devs: JudgeCandidate[], cfg: any = JUDGES) => {
    let both = 0, mixed = 0, compFirst = 0;
    for (let i = 0; i < N; i++) {
      const j = drawJudges(rng, devs, 2, cfg, new Map());
      if (j.length === 2 && j.every((x) => x.startsWith("A"))) both++;
      const k = j.map((x) => devs.find((d) => d.id === x)!.kind);
      if (k[0] !== k[1]) mixed++;
      if (k[0] === "computer" && !j[0]!.startsWith("A")) compFirst++;
    }
    console.log(`${name.padEnd(55)} both-atk ${(100*both/N).toFixed(2)}%  mixed ${(100*mixed/N).toFixed(1)}%  honest-computer-first ${(100*compFirst/N).toFixed(1)}%`);
  };
  const ig = { ...JUDGES, pairClassMin: 1e9 };
  row("98 phones; 2 atk comp 3M", [...mk(98,3e5,"phone","p"), ...atk(2,3e6,"computer")]);
  row("review: 20c 2M + 78p; 2 atk comp 3M", [...mk(20,2e6,"computer","c"), ...mk(78,3e5,"phone","p"), ...atk(2,3e6,"computer")]);
  row("3c+95p; 2 atk", [...mk(3,2e6,"computer","c"), ...mk(95,3e5,"phone","p"), ...atk(2,3e6,"computer")]);
  row("62p; 2 atk", [...mk(62,3e5,"phone","p"), ...atk(2,3e6,"computer")]);
  for (const n of [3,4,5,6]) { row(`98-n phones; ${n} atk comp 3M`, [...mk(100-n,3e5,"phone","p"), ...atk(n,3e6,"computer")]); row(`  same, class ignored`, [...mk(100-n,3e5,"phone","p"), ...atk(n,3e6,"computer")], ig); }
  for (const n of [4,6,8,10,20]) row(`small: ${n-2} phones + 2 atk`, [...mk(n-2,3e5,"phone","p"), ...atk(2,3e6,"computer")]);
  for (const n of [4,6,10,20]) row(`small: ${n-2} phones + 2 atk at phone speed claiming comp`, [...mk(n-2,3e5,"phone","p"), ...atk(2,3e5,"computer")]);
  row("50c 2M + 48p; 2 atk comp 3M", [...mk(50,2e6,"computer","c"), ...mk(48,3e5,"phone","p"), ...atk(2,3e6,"computer")]);
  row("48c 2M + 50p; 2 atk comp 3M (median phone side)", [...mk(48,2e6,"computer","c"), ...mk(50,3e5,"phone","p"), ...atk(2,3e6,"computer")]);
  row("98c 2M; 2 atk comp 3M", [...mk(98,2e6,"computer","c"), ...atk(2,3e6,"computer")]);
  row("98p; 2 atk phone 3M (all one class)", [...mk(98,3e5,"phone","p"), ...atk(2,3e6,"phone")]);
  row("honest 3c 2M + 97p", mk(3,2e6,"computer","c").concat(mk(97,3e5,"phone","p")));
  row("honest 5c 2M + 95p", mk(5,2e6,"computer","c").concat(mk(95,3e5,"phone","p")));
  row("honest 10c 2M + 90p", mk(10,2e6,"computer","c").concat(mk(90,3e5,"phone","p")));
  row("honest 20c 2M + 80p", mk(20,2e6,"computer","c").concat(mk(80,3e5,"phone","p")));
});
