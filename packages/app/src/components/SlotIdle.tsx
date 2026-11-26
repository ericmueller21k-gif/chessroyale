/**
 * A standing status box with nothing to say (Eric, Nov 26: "same treatment" as the vote box): always there, in the same place and size as
 * "White is voting…", gray like the skeleton rows, with a quiet "Waiting…", never a blank hole. The 50 v 50's status box on your own pick;
 * Squads' pick on a computer while there's nothing to pick.
 */
export function SlotIdle() {
  return (
    <div class="waiting-banner slot-idle" aria-hidden="true">
      <i />
      Waiting…
    </div>
  );
}
