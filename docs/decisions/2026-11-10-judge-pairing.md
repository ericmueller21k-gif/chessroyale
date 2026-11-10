# Judge pairing: weight 2, cap 3M, computer with computer (Nov 10, 2026)

Review of PR #601, major 1: a linear weight put about half of all jobs on a computer + phone pair; the computer answers
first, the phone is past the grace, so the computer's answer is used alone (25% spot check). Calls: `speedWeight` 2,
`maxNps` 3M (a fast desktop's real speed), and the second judge drawn from the first's class (computer or phone, as
the device said at hello) while that class has anyone left; else anyone (a pair beats one judge).
Measured (unit sim, `device-trust.test.ts`, 20,000 draws; 20 computers at 2M, 80 phones at 300k):
- mixed pairs (one answer used alone): linear 47.6%; weight 2 only 15.6%; weight 2 + class **0%**;
- phone + phone pairs (slower, but together): about 8% (the phones' share of the first judge's weight);
- a two-account attacker at the cap, both judges of one board: 1.1% before (linear, 5M), **1.9%** after.
A replacement or referee judge (one at a time) is drawn from everyone, as before.
