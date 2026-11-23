# Discord alerts (Nov 10, 2026)

Eric, Nov 10: "I haven't set up the Discord alerts yet ... we'll need to do that." Built piece 1 of docs/ideas/live-ops.md.
- **Calls:** play errors are the Worker's on match, lobby and queue routes (their stored route) plus the Durable Objects' as a second signal; a window is the stored hourly count's change since the last check (state: one `meta` row, no new table). D1 can't hold its own state, so its "two in a row" is two reads 30 s apart, its repeat held in memory.
- **Later:** abandon rates, the live-site bot, known-noise labels (docs/areas/ops.md, "Alerts to Discord").
