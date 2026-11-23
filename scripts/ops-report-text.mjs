/**
 * Text a player's device wrote (anyone can send it through POST /api/problems), made safe to print for a person or an
 * AI session to read (scripts/ops-report.mjs): every control, format, private-use, unassigned, line- and
 * paragraph-separator character a space (so no line breaks, direction marks, zero-width or tag characters, the
 * hidden-text trick, get through), runs of spaces one, cut to `max` characters.
 */
export const oneLine = (text, max = 110) =>
  [
    ...String(text ?? "")
      .replace(/[\p{C}\p{Zl}\p{Zp}]/gu, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ]
    .slice(0, max)
    .join("");
