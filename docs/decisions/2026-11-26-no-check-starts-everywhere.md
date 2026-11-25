# No opening starts in check, in any mode, Nov 26, 2026

Eric, Nov 26 ("Yes"), after Squads dropped them (Nov 25): solo, Classic, the 50 v 50's Random opening and raids drew from the same
library and could start with the side to move in check (the Steinitz Gambit at 4 moves; six lines at 5; Classic's Black boards one ply
on, e.g. the Caro-Kann's 5.Nxf6+). Built: `usableAt` (openings.ts) now also requires the start not to be in check (`startsInCheck`,
worked out once per line and length), so `pickOpenings` and every caller, Squads' `squadsOpenings` included, skip them; the runner's
two fallbacks skip them too. The library file is unchanged. Tests: rules.test.ts "never picks a line that leaves the side to move in
check"; uci.test.ts's two-reply position is now a fixed FEN (it's no longer dealt).
