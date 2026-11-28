# The power banner looks inconsistent (Eric, Nov 28). Opus, high (presentation shared by every boss). Targeted lane.

Eric, Nov 28, a screenshot of the Stranger's ult banner on his iPhone ("STORM OF TWO WORLDS!", "Three turns of ice and fire"): "how bad
this banner looks… All the words look different… it looks so AI slop. His name looks weird… the text is hiding, and the worlds is, like,
bigger than the rest." What the still shows: the boss's name ("Stranger") small, grey, a different (mono) face, half lost on the stripes;
the title on three lines, each line sized on its own, so "WORLDS!" is bigger than "STORM" and "OF TWO"; the subtitle in yet another
style; the title's lines crowding the portrait.
Read `notes/briefs/rules-common.md`, `.claude/LESSONS.md`, the banner's code (`p.banner(…)` in `PowerParts.tsx`, its CSS in `styles.css`,
the `long` variant) and the boss area page. Branch `claude/banner-consistent` from `origin/main`.
- **One look for every boss's banner:** the title's lines all one size (sized to the longest line that must fit, never per line), one
  type family for the name, title and subtitle (weights and sizes may differ, faces don't), the boss's name readable and clearly placed
  (not small grey mono on the stripes), nothing behind the portrait or the pawn art. Simple beats flashy (CLAUDE.md): reuse the existing
  banner, fewer rules, not more.
- **Proof:** a sheet of every boss's banner(s) on a phone (390 px) and a computer, with the longest titles (the Stranger's first). The
  director reviews the stills before Eric sees them; one still per platform goes to Eric.
Five-line decision note, the boss area page. Commit AND push `.pr-body.md` and `.done` (`git add -f`), check `git ls-remote`, stop.
About an hour.
