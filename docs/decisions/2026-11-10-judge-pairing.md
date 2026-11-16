# Judge pairing: weight 2, cap 3M, computer with computer (Nov 10, 2026)

Review of PR #601, major 1: a linear weight put about half of all jobs on a computer + phone pair; the computer answers
first, the phone is past the grace, so the computer's answer is used alone (25% spot check). Calls: `speedWeight` 2,
`maxNps` 3M (a fast desktop's real speed), and the second judge drawn from the first's class (computer or phone, as
the device said at hello) while that class has anyone left; else anyone (a pair beats one judge).
Measured (unit sim, `device-trust.test.ts`, 20,000 draws; 20 computers at 2M, 80 phones at 300k):
- mixed pairs (one answer used alone): linear 47.6%; weight 2 only 15.6%; weight 2 + class **0%**;
- phone + phone pairs (slower, but together): about 8% (the phones' share of the first judge's weight);
- a two-account attacker at the cap, both judges of one board: 1.1% before (linear, 5M), **1.9%** after.

**Round 2 (delta review, blocker 1): a claimed class.** The class is the device's own word, so two accounts claiming
"computer" in a lobby of phones got both judges 67% of the time (the second came only from "their" class). Calls:
- pair by class only when the first's class has `pairClassMin` **3** other accounts left; else the second from anyone;
- a speed counts at most `medianCap` **3** times the lobby's median (and `maxNps`): 3, not the review's 4, because 4
  left a 62-phone lobby at 6.9%, over the 5% aim;
- a refill beside a remaining judge, and a dispute's referee (when the two share a class), come from that class under
  the same threshold; a late answer's referee (nothing waits on it) from anyone.
Two attacker accounts claiming "computer" at 3M, both judges of one board (20,000 draws, `device-trust.test.ts`):
review's lobby (20 computers 2M + 78 phones) 0.35%; 98 phones 1.5% (was 66.8%); 98 phones, no speed lie 0.02%;
3 computers + 95 phones **3.3% (the worst case)**; 62 phones 2.9%; 98 computers, attackers claiming "phone" 0.1%.
The review's lobby keeps real computers together: mixed pairs 0% (linear 47%), a computer judges first 70%.
**Round 3 (delta review 2, director):** a fixed 3 could be supplied by the attacker (four accounts claiming "computer"
among phones: both judges 29%). The class must also hold `pairClassShare` **10%** of the lobby's accounts; then the draw
is as if classes were ignored: 4 accounts 5.9%, 6 accounts 11.7%, 10 accounts 23.4% (in 100). Honest lobbies with 11+
computers keep 0% mixed pairs; 5-10 computers among phones get mixed pairs again (about 25%).
Left over, by lobby size (two accounts claiming "computer" at 3M among phones): 20 devices 18%, 10: 36%, 6: 58% (the
median cap is 9 phones' weight). Lobbies that small with judging are private ones and small raids. Measured speed fixes
it (ROADMAP).
