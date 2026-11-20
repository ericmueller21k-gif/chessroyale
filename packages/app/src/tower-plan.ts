import type { NetTowerPlan } from "@chessroyale/chess/squads";

/** What READY or START asks first (your own climb ends, or goes back floors), or null. */
export interface PlanAsk {
  heading: string;
  note: string;
}

/** "1 party climb", "3 party climbs". */
const climbs = (n: number) => `${n} party climb${n === 1 ? "" : "s"}`;

/**
 * The plan's words for this device (`me`: your member id): what START does (`line`), the up button's words in the floor room (`up`), and
 * what READY or START asks first (`ask`): when it ends your own party climb, or takes it back floors you played alone (the director's call
 * on the review of #835, finding 10, asked first as for an end). The line names your own climb's floor and counts the others' (the delta
 * review of #835, finding 3: named with their floors, a four-member party's line grew past the three lines the clerk's card keeps for it,
 * and everything under it moved); who's in the party shows on its seats, and each is asked about their own climb as they READY.
 * A pure module (no app state), so the e2e measures these very words in the card's box.
 */
export function planWords(plan: NetTowerPlan | undefined, me: string | null): { line: string; up: string; ask: PlanAsk | null; ok: boolean } {
  if (!plan) return { line: "", up: "START", ask: null, ok: false };
  if (plan.kind === "wait") return { line: plan.message, up: "START", ask: null, ok: false };
  if (plan.kind === "continue") {
    const back = plan.back ?? [];
    const mine = back.find((b) => b.id === me)?.floor;
    const others = back.length - (mine === undefined ? 0 : 1);
    const goes =
      mine !== undefined ? ` Yours goes back from floor ${mine}${others ? `, and ${others} more` : ""}.` : others ? ` ${climbs(others)} go${others === 1 ? "es" : ""} back to it.` : "";
    return {
      line: `Your climb together goes on: floor ${plan.floor}.${goes}`,
      up: `Up to floor ${plan.floor}`,
      ask: mine === undefined ? null : { heading: `Back to floor ${plan.floor}?`, note: `Your climb goes back from floor ${mine} to floor ${plan.floor}, where your party left off. Your best floors stay.` },
      ok: true,
    };
  }
  const mine = plan.ends.find((e) => e.id === me)?.floor ?? null;
  const others = plan.ends.length - (mine === null ? 0 : 1);
  const ends = mine !== null ? ` It ends yours on floor ${mine}${others ? `, and ${others} more` : ""}.` : others ? ` It ends ${climbs(others)}.` : "";
  return {
    line: `A new climb from floor 1.${ends}`,
    up: "New climb: floor 1",
    ask: mine === null ? null : { heading: "Start a new climb?", note: `Your party climb on floor ${mine} ends, and this party starts on floor 1.` },
    ok: true,
  };
}

/** The leader's plan line while some of the others haven't readied (START greyed): the plan, then how many (the seats' ✓ show who). */
export const planWaiting = (line: string, waiting: number): string => `${line} ${waiting} not ready yet.`;
