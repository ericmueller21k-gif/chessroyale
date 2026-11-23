# Flaky batch 7 (Nov 10, 2026)

Seven tests that passed only on their retry on main. Calls:
- Home's boss-portrait warm-up waits while a game starts (Bot level box, queue): one face took a slowed phone most of a second as PLAY or OK was tapped. 12× slowdown, Bots OK to full: 4.8–5.4 s → 3.1–3.4 s (matchmaking, home-layout).
- Babur's put plays from its first draw: a hitch over its 160 ms skipped it (tiger).
- The RANKED label's line fixed at Archivo's 14 px: your card resized as the font landed (search-home).
- Spec only: recluse reads marks and count together; squads-replay's move may capture.
- squads-watch: cause not found (10/10 locally); a repeat now names it.
