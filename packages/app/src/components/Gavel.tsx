/**
 * The judge: a chess piece in the board's own style (white with a black outline, cburnett-like) that's a gavel,
 * standing on a wooden sound block. `slam` swings the gavel down onto the block.
 */
export function GavelPiece({ slam = false }: { slam?: boolean }) {
  return (
    <svg class={`gavel-piece${slam ? " slam" : ""}`} viewBox="0 0 45 45" aria-hidden="true">
      <defs>
        <linearGradient id="gavel-wood" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#c58a4c" />
          <stop offset="1" stop-color="#8a5a2b" />
        </linearGradient>
      </defs>
      {/* The sound block: a wooden cylinder, like a piece's base. */}
      <g stroke="#000" stroke-width="1.5" stroke-linejoin="round">
        <path d="M9 34.5 v4 a13.5 3.5 0 0 0 27 0 v-4" fill="url(#gavel-wood)" />
        <ellipse cx="22.5" cy="34.5" rx="13.5" ry="3.5" fill="#d9a066" />
        <path d="M12 37.6 q10.5 2.6 21 0" fill="none" stroke="#6b4423" stroke-width="0.8" />
      </g>
      {/* The gavel: head and handle, pivoting at the handle's end. */}
      <g class="gavel-swing" stroke="#000" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
        <path d="M23.5 17.5 L35.5 29.5" stroke-width="4.5" />
        <path d="M23.5 17.5 L35.5 29.5" stroke="#fff" stroke-width="2" />
        <g transform="rotate(-45 18 12)">
          <rect x="9" y="7.5" width="18" height="9" rx="2.5" fill="#fff" />
          <rect x="12" y="7.5" width="2.2" height="9" fill="#000" stroke="none" />
          <rect x="21.8" y="7.5" width="2.2" height="9" fill="#000" stroke="none" />
        </g>
      </g>
    </svg>
  );
}
