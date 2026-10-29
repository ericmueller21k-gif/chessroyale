/**
 * The two little icons on a person's card (Oct 28, Eric's mockup), plain inline SVG in the text's own color: the crossed swords
 * ("challenge", left of "Play": the one in place of the mockup's triangle) and the signal bars beside the rating. Both are
 * decoration: the words next to them say it all, so they're hidden from screen readers.
 */

/**
 * Two swords crossing (a plain "challenge" icon): each upright, a blade, a crossguard, a grip and a pommel, turned 45 degrees either
 * way about its blade's middle, so the blades cross high and the hilts spread out below.
 */
function Sword() {
  return (
    <>
      <path d="M0 -11.8 1.9 -9V5H-1.9V-9Z" />
      <rect x="-5.2" y="4.8" width="10.4" height="2.5" rx="1.2" />
      <rect x="-1.3" y="7.2" width="2.6" height="3.2" />
      <circle cx="0" cy="11.6" r="1.9" />
    </>
  );
}
export function SwordsIcon() {
  return (
    <svg class="town-ico-swords" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <g fill="currentColor" transform="translate(12 11.6)">
        <g transform="rotate(45)">
          <Sword />
        </g>
        <g transform="rotate(-45)">
          <Sword />
        </g>
      </g>
    </svg>
  );
}

/** Three bars rising, in the rating's gold. */
export function BarsIcon() {
  return (
    <svg class="town-ico-bars" viewBox="0 0 12 10" width="11" height="9" aria-hidden="true" focusable="false">
      <rect x="0" y="6" width="3" height="4" rx=".6" fill="currentColor" />
      <rect x="4.5" y="3" width="3" height="7" rx=".6" fill="currentColor" />
      <rect x="9" y="0" width="3" height="10" rx=".6" fill="currentColor" />
    </svg>
  );
}
