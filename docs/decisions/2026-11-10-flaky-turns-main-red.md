# A flaky test turns main red; the retry stays for its trace (Nov 10, 2026)

Audit F1's step 2 ("retries to 0 on main") after the second flaky batch (#590). Retries 0 would also lose the trace (it's
recorded only on the retry), and the traces found most of #590's causes. So CI keeps one retry, and on main a test
that passed only on it fails the `result` job: no flake hides, and each comes with its trace. PRs aren't held up.
Main went green three runs in a row before this (993103d, fea88f3, b6694e4).
