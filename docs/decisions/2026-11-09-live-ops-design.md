# Live ops: designed, built before launch (Eric, Nov 9)

Eric: "we don't have developers … it's going to need to be in the know with things that are breaking and be able to make fixes",
"the last thing I'd want is … we're in panic thinking there's issues when there's really not", and on where alerts go: "whatever's
easiest to build and cheapest". The design: docs/ideas/live-ops.md. Discord (free; the app pushes to his phone). Alerts from the
existing 15-minute cron, an on-call scheduled agent, a live-site bot on GitHub Actions, gradual deploys, and no-false-alarm rules.
Not built yet; ROADMAP.md, "Live ops".
