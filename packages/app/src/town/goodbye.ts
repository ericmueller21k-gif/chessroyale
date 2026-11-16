/**
 * Back from a boss's battle that it fought from the town: that boss (its home's id) says its goodbye as the town opens (Eric,
 * Nov 7), once, in its bubble. The app sets it as it leaves the battle; the next createTown takes it (and clears it: world.ts).
 * A leaf module (no imports), so the app doesn't import the town's world to set it.
 */
let goodbyeFrom: string | null = null;
export function setGoodbyeFrom(id: string | null): void {
  goodbyeFrom = id;
}
export function takeGoodbyeFrom(): string | null {
  const id = goodbyeFrom;
  goodbyeFrom = null;
  return id;
}
