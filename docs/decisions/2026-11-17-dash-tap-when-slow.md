# Dash's clock tap only when you're slow (Nov 17, 2026)

Eric (with a screenshot of it at move 4, his moves in 0-2 s): "Bugged already, it fired off like 5 seconds into the match even tho I played all my moves instantly". It was a seeded turn 3-9, 900 ms into that move, however fast you played.
- **When** (the director's call): once a battle, from move 3, as a move of yours reaches 10 s of a bank (Boss alone, a party) or 30% of a move clock (raids, group battles: 6 s of 20); a quicker move gets nothing and it stays armed (`DASH_TAP`). Never on a move with another moment of his. `?power=clocktap`: from move 1.
- **Never on the stall skit's move** (Eric: "No the bigger gag is reserved for another turn"): the tap is a beat of `stallPlan`, timed with the slam and the fake move by solo and the server (`nextBeat`); on the move it comes (`dash.tap`, Eric: "it's a variable state"), no slam or fake move. No clock stops for it. Message `stall` with beat `tap`.
- **He stays lying until you move** (Eric: "just have him stay in the crawl position", the move's whole length, the director's reading); 20 s after he's down, "Bro, I'm not moving till you do." His crawl in always finishes ("let the crawl finish"): your move in before he's down, "Ayy homie, relax, it's just a joke." first. Lines are placeholders for Eric.
- **His words over him** while down (Eric: "it should show above him like over the board a bit wherever it's not blocking him or your clock"): his box centered over him, never under his cap or the time's top; the usual box away. `DashTap` is drawn beside the match's screens, so a move going in doesn't cut him off.

## Review fixes (Nov 17, the review of #775)

- **Only the players still thinking see it** (the director's call): `DashTap` starts a tap only when it's first seen in `play` with no pick of yours (`tapSeen`). A raid player who already moved (`scoring`) and a party member who picked (`myPick`) never get the crawl or the joke; a pick gets him up for you, as your move going in does. The server still sends it to everyone and keeps it in `r.last`, so a reconnect before your pick still sees him lying.
- **His taps tick aloud for 3 s only** (`DASH_TAP.tapMs`): then he taps on silently. The review counted about 150 clicks in a 60 s think.
- **Never in the move's last 2 s** (`DASH_STALL.marginMs`, in `stallPlan`): solo and the server plan the same, so solo can't start a crawl just before you flag.
- **Accepted, no code** (Eric: "let the crawl finish"): in the joke case his own reply's moment (a Clock Slap's slap) plays while his figure is away, about 2.8 s; the banner, the dock and his line still show it.

