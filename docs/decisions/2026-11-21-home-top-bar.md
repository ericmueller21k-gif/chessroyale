# Home's phone top bar built like Chess Town's (a trial)

**Date:** Nov 21, 2026. **Eric:** "Yeah, just do the home screen change, and I will test it ... be prepared if that will probably have to revert it."

On the installed iPhone app, iOS 26 frosts page content in a band under the status bar (Home's top row, Auto chess's title); Chess Town's top
bar, a solid bar at the screen's top edge, stays sharp. Home's phone top row is now built the same way: pinned (`position: sticky; top: 0`),
solid (`--fd-bg`), from the very top, with the page's 10 px top padding and 18 px side margins moved inside it, so it sits and looks exactly
as before (screenshots at 360, 390 and 430 px wide matched except the animated pictures). Below 1024 px wide only (a computer's home has no top row); computers
unchanged. Chromium can't show iOS's blur, so Eric's phone is the check. If it doesn't help, revert the one CSS rule in `styles.css`
(after `.fd-top`). If it does, the other screens' top rows get the same build.
