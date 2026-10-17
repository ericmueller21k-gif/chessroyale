# One contact address: support@hunchess.com (Oct 17)

**Decision (Eric):** "I think we just need support to handle all." The site names one address, support@hunchess.com, wherever
players or parents are told to write: the privacy policy and terms (`CONTACT` in `packages/app/src/screens/Legal.tsx`) and the
note in "Download my data" (`packages/server/src/account-data.ts`). It replaces privacy@hunchess.com.

**Why:** one inbox is simpler to watch, and the law asks for a way to reach us, not a separate privacy address.

**Setup (Eric, in Cloudflare):** Email Routing on hunchess.com, a verified destination inbox, a custom address `support`, and the
**catch-all** on, forwarding to the same inbox. The catch-all matters because the game sends from login@ (sign-in codes) and
fairplay@ (fair-play notices); without it, a player's reply to either bounces.

**Later:** replying *as* support@ needs an outgoing mail service (Eric approves any cost first), and the AI-handled support
inbox planned on Oct 15 routes support@ to a Worker instead of straight to Eric. Both build on this setup.
