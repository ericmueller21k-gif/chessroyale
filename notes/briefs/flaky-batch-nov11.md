# Flaky batch, Nov 11 (main red 4 runs in a row on retry-only passes)
Main's full run turns red when a test passes only on its retry (Nov 10 rule). Fix each at its CAUSE: no added retries, no skips, no longer
sleeps as the fix. A longer wait is OK only where it waits for a real, slow, legitimate thing (and say what).
Recent (run ids from main's e2e workflow):
- boss-challenge.spec.ts:155 [phone, desktop] Alfil in the town: toEqual deep equality (42987297216; also on PR #635)
- town-chat.spec.ts:1410 [phone] name tap: Profile/Mute/Report: toHaveCount (42987297216)
- squads-play.spec.ts:304 [phone] party sheet Escape: toHaveCount (42983325680)
- town-chat-history.spec.ts:57 [phone] data-ready 5 s wait (42980337575) -> already given 40 s in PR #639 (town loading); check after it merges
- squads-replay.spec.ts:125 [desktop] Relay replay button: toBeVisible (42980337575)
- shop.spec.ts:1480 [desktop, phone] Shop tab page: toHaveCount (42976152896 and many before)
- timber.spec.ts:79, panel.spec.ts:82 (Nov 11 05:22 / 04:54 runs)
Older list: shop.spec:1094 [desktop] (goIn: home not drawn in 20 s), xp-rewards:44, walkthrough:227 [desktop], home-ranked:300 [desktop], global-chat:46, boss-challenge:1169, hopper:212, boss-bar:204; fairplay.spec:96 never runs.
