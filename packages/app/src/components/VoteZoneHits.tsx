/**
 * Tap a vote zone and your pawn goes there, in every pawn vote (Eric, Nov 2: "Tapping on an augment area puts your piece there"; Nov 25,
 * a standing rule for every mode: docs/rules/eric.md): the 50 v 50's, Squads', a raid's (screens/Vote.tsx) and the 1 v 1's and the town
 * games' (DuelVote.tsx), whether or not you picked your pawn up first. One button over each zone takes the tap, so the board under it
 * never gets one; the vote moves your pawn there as a drag would (its glide is the layer's CSS).
 */
export interface VoteZoneHit {
  key: string;
  /** The button's name ("Vote Strong", "Pick Bullet 1+1"). */
  label: string;
  /** The zone's box on screen, in percent of the board. */
  box: { left: number; top: number; width: number; height: number };
  /** "Coming soon": no tap. */
  disabled?: boolean;
}

export function VoteZoneHits({ zones, onTap }: { zones: readonly VoteZoneHit[]; onTap: (i: number) => void }) {
  return (
    <>
      {zones.map((z, i) =>
        z.disabled ? null : (
          <button
            type="button"
            key={z.key}
            class="vote-zone-hit"
            aria-label={z.label}
            style={{ left: `${z.box.left}%`, top: `${z.box.top}%`, width: `${z.box.width}%`, height: `${z.box.height}%` }}
            onClick={(e) => {
              e.stopPropagation();
              onTap(i);
            }}
          />
        ),
      )}
    </>
  );
}
