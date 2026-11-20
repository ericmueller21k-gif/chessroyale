# UI consistency: centered, tidy cards (Nov 20). Opus, high. Light/targeted lane. After #839 (lives) merges (TowerDesk conflicts)

**Eric, Nov 20 (on the clerk's card, screenshot: left "OPEN PARTIES" label and left hearts row under a centered "Clerk"; the card
off to the left of the screen; a tall empty "Reading the open parties..." box; dead space):** "...stuff better. You see how like the text in
the container, but also the container itself. Like things that's gonna get us dinged for being lazy ... I've noticed kind of a handful of
different spots in the UI where we're not. We have like left indented text and then center indent. Like things need to be consistent.
Like look at open party sitting on the left and clerks in the middle. Like everything should be centered there. The whole box itself
should be centered. I mean, on the page, like that's just going to make it look way smoother. Those are the small things that add up."
1. **The clerk's card:** centered on the page (phone and computer), not hung off the clerk; every label, line and row inside centered
   (OPEN PARTIES, the seats' contents, the hearts row, the plan/status lines); the open-parties box sized to its content's rows (no tall
   empty well; its "Reading…"/"No open parties right now." centered in it); no dead gaps. Nothing hidden, nothing shifts (sizes fixed
   across states). Same for the other town cards (shops, homes, the elevator's) if they share the component.
2. **A sweep:** find the other places where a card/panel mixes left- and center-aligned text or sits off-center (town cards, result screens,
   home's cards, settings' sections, the boss dock cards, the tower bar/result), list them with stills (before), fix them to one rule:
   in a card or panel, titles, labels and short lines are centered and the card is centered; long body text and lists of rows stay
   left-aligned inside a centered column only where they're truly lists (state the rule in the decision note, and add it to
   `.claude/LESSONS.md`). Stills before/after (phone + computer), one set.
3. One focused e2e check (e.g. the clerk's card centered in the viewport within 2 px; its labels' text-align center).
