# The installed iPhone app: a solid status bar, not black-translucent (Nov 20, 2026)

**Eric (Nov 20, his iPhone):** "The app on my iPhone is blurry at top ... the browser doesn't have this problem??" Home's top
bar (the wordmark and the chat, quests, shop, friends and settings buttons) was frosted and washed out in the Home Screen
app, crisp in Safari's tab.

**Cause:** `index.html` asked for `apple-mobile-web-app-status-bar-style: black-translucent`, so the installed app drew the page
under the status bar. Since iOS 26.1, iOS frosts that band with its own scrim, and the page can't turn it off. Our top bar
already starts below `env(safe-area-inset-top)`, and it was still blurred: developers report the frost reaching past the
inset (WebKit bug 301994, still open on iOS 27.2). None of our own layers caused it, since the tab (inset 0) was fine. WebKit's
own advice (bug 317153, June 2026): `black-translucent` "has been deprecated for multiple releases ... Please remove this
key, and the status bar should automatically appear in the same color as the webpage."

**Change:** the key is gone. iOS draws a solid status bar and the page starts below it (the inset becomes 0, so every
screen's `env(safe-area-inset-top)` padding simply collapses; nothing to change per screen). `theme-color` now follows the
theme: the front door's ground, `#14161b` dark and `#f4f2ee` light (`THEME_COLOR` in `theme.ts`, set before the first paint
by `index.html`'s script, a unit test keeping them equal). Before, it was always the dark `#1b1d22`. The manifest's
`theme_color` is the dark one too.

**Calls made:** (1) WebKit's fix over keeping `black-translucent` and pushing the top bar further down: less code, no guessed
band height, and Apple's stated direction. (2) One status-bar color per theme (home's ground) rather than one per screen: the
town and the match draw `--bg`, a shade off (`#16181d` / `#f3f1ec`), close enough not to read as a seam. (3) Safari's tab is
unchanged: the inset was already 0 there.

**Only a real iPhone can confirm it:** iOS reads the tag when the app is added, so Eric deletes the HunChess icon and adds it
again from Safari. If the frost is still there, the next step is a solid strip pinned to the top edge (another project's
on-device fix).
