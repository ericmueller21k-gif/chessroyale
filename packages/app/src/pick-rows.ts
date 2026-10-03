/**
 * Which players the small scoreboard shows when only `rows` fit, most
 * important first: you, the leader, the two either side of the cut line, your
 * neighbours, the rest of the top five, then outwards from you (as many as fit).
 */
export function pickRows(n: number, me: number, cutoff: number, fits: (keep: Set<number>) => boolean): Set<number> {
  const knockouts = cutoff > 0 && cutoff < n;
  const order = [me, 0, ...(knockouts ? [cutoff - 1, cutoff] : []), me - 1, me + 1, 1, 2, 3, 4, me - 2, me + 2];
  if (knockouts) order.push(cutoff - 2, cutoff + 1);
  for (let d = 3; d < n; d++) order.push(me - d, me + d);
  for (let i = 0; i < n; i++) order.push(i);
  const keep = new Set<number>();
  for (const i of order) {
    if (i < 0 || i >= n || keep.has(i)) continue;
    keep.add(i);
    if (!fits(keep)) {
      keep.delete(i);
      break;
    }
  }
  return keep;
}
