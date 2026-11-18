# Payments: Eric's answers (Nov 17, ~15:15 UTC) and the director's picks sent back for OK

Eric: "I want it to show hunchess.com so do I need to get the LLC? ... Web only at least for now. Stripe seems fine, just one
currency. What do you think priced should be? 8 sure spending cap. Everything costs coins even the packs, so you can earn coins to
buy them. Which countries? Whatever is easiest and where chess is most played."

Decided by Eric: web only; Stripe; one coin (server records bought coins separately); spending cap for minors; everything priced in
coins (bundle too), only coin packs cost money.
Director's picks sent for OK: statement "HUNCHESS.COM" (no LLC needed for it; LLC recommended for liability before live money);
100 coins = $1; packs $1.99/200, $4.99/520, $9.99/1100, $19.99/2300, $49.99/6000; US first (+ Canada), others play and earn but
can't buy yet; UK/EU/India later; never Belgium; refunds of unspent coins within 14 days; chargeback takes the coins back (balance
can go negative) and blocks buying; odds on every crate; under 16 no purchases (FTC v. HoYoverse, Jan 2025), 16-17 $50/month cap
(age gate gains an "18+" answer, still no birth date stored); Stripe test mode on the private site first; the 50% beta discount
ends when real money turns on; a lawyer's one-time review before live.
Next: payments design/research helper (Opus high, read-only + doc) with exact current fees, when a slot frees (after moo stills).

## Eric, Nov 17 ~15:35 UTC
"I'll honestly just use AI for legal, I'll have you create a comprehensive file and screenshots and have 2 separate AI models review
it and compare. No need to write this up till we are done. Refunds should be hassle free and stated clearly. But how do we refund
if people open crates? ... I wanna find a flexible solution. There's no greed here. Also we should actively encourage people to
simply level up and play to earn gold instead of spending money maybe? Your other recommendations are fine. It should cost about $1
for a key and crates should be earned every level and from other areas easily so the only thing you need are keys mainly from gold"

- Legal: no lawyer; at the end, a full legal pack (file + screenshots) reviewed by two AI models and compared. Not until built.
- All other picks OK'd (LLC before live, US+Canada, under 16 no buying, 16-17 $50/month, test mode, beta discount ends, odds).
- Director's proposals sent (await OK): key = 100 coins = $1 (from 250; ~55 min of play); 100 coins = $1 packs as before; crates
  stay earned (2 a level + 1 key, daily, quests); the design helper re-balances crates vs keys flow and other coin prices.
- Refunds (proposal): bought coins kept apart and earned coins spent first; a Refund button: whole pack untouched -> full refund,
  partly spent -> the unspent part back, no questions, 14 days; opened crates: "return" an item opened with bought coins within 14
  days for its key's money (item removed), once every 30 days; unauthorized/parent claims: full refund, items removed, any time;
  support@ can always say yes.
- Earn-first nudges (proposal): every pack shows "or about N games of play"; next free crate/key shown; no purchase pop-ups, no
  timers on paid packs, no fake discounts; "Play to earn" first in the coin screen.

## Eric, Nov 17 ~15:40 UTC (approves the round-2 proposals: "This looks good")
"keep all currency still as one number, but to make it simple, when you make a purchase add a one time popup that says your
refundable coin balance can be viewed anytime in your profile with a single line below here that says something like 'total coins,
refundable coins'" -> one coin number everywhere; after the first purchase, a one-time pop-up; your own profile gets one line
"Total coins N · Refundable N" (in the payments build). Key 100 coins = $1, refunds plan, earn-first nudges: approved.

## Eric, Nov 18 (round 4: refunds, chargebacks, age; word-for-word essentials)
"don't fight chargebacks ... err on the side of being very user friendly ... when people refund, send a message that says, like, you
know, sorry, you weren't happy. Please keep your items as a thanks for trying HunChess. If there's something we could be doing
better, please submit a comment ... optional ... a submit that's grayed out. If they type something, they can submit. Otherwise,
they can just bypass ... The honor system ... put a quiet flag in the system ... I don't think we even need to build a system for
taking back items ... disable purchasing on their account with real money ... and also disable trading ... three refunds after that.
Just put a 90-day hold on trading and purchasing real in-game currency. And we don't even need to put a message up, just the same
refund message ... if someone lies [about age], uses their parents' credit card, let's call that a good problem to have ... not fight"

Decided: never fight a chargeback; refunds keep items (no item return/undo system); refund pop-up with an optional comment (Submit
greyed until text, or close); a quiet flag: the 3rd refund (chargebacks count) starts a 90-day hold on buying coins and on trading
(when trading exists), no extra message. Age stays self-declared (the bands as proposed).
Director's reading to confirm: unspent bought coins come off with the refund (a number, not an item); opened items stay.
Still open (round 3 calls 1-3): play coins in every mode; 1 crate a level; the lower coin prices.

## Eric, Nov 18 (round 5; voice, essentials)
- "Yeah, take back the coins." (unspent bought coins come off with a refund; opened items stay)
- Admin: "another tab for anyone that's done refunds ... where it also shows their comments or chargebacks ... separate from the ban one".
- Held accounts: "just gray it out ... you can still click it, but it just looks gray, and then if you click it, it just can say ...
  purchasing is not possible on this account" (he considered a fake "error processing" and dropped it as too complicated).
- Chargebacks: "after one chargeback ... the second chargeback closes the account, as long as we're legally allowed ... put up a
  message ... we don't fight them, but they do cost us money ... any further chargebacks will result in a termination of your account".
- Coins from every mode, time-based, capped (300/day for minutes), "but you can also continue to get more ... if you place well ...
  we don't want people to be like, oh well, I can't get more coins, so I don't want to play anymore" -> director does the math.
- Coin boost (no real money): "2.5 times coin boost for your next certain hours of play", from a crate that occasionally drops from a
  daily quest. "Forget the experience. I want experience to be genuine based on amount of playtime." Art by the API runner.
- Coin reward feel (roadmap + mockup): after a match with coins, a box (the Final Fantasy-style pop-up style we already use) or a spot
  on the results screen; coins dropping and a counter clocking up like a gas pump; a nice coin sound; cheap on the GPU (a few
  pre-drawn coin sprites/loops, not each coin simulated). "send me a mock-up".
- Prices: crates 50-75 fine "as long as it's something we can easily tweak later ... run some simulation or look at what the average
  game does". 1 crate a level: yes. New quest reward: a "crate bonus": your next 5 level-ups give double crates; drops occasionally
  from daily quests.
