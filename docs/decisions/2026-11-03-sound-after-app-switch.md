# Sound after switching apps on iPhone (Nov 3, 2026)

Eric: "I challenged him, surrendered, went to the Claude app, then back to HunChess: the audio is gone." Then, standing outside
Big Boy's Crib: switched apps, came back, no sound. So the cause is the app switch, not the challenge path (checked: nothing there
mutes, suspends, closes or replaces the audio context).

- iOS suspends or "interrupts" the Web Audio context while the page is hidden and doesn't always let `resume()` bring it back.
- The call: the first tap after coming back makes a **new** context whenever the old one isn't running with its clock moving,
  instead of trying `resume()` first and rebuilding only if that fails. Eric wants sound back on the first tap, with no reload and
  no settings toggle. A rebuild after a failed resume would happen outside the tap, so iOS would need a second tap. A new context
  costs one creation per return (the boss sounds' cache is by sample rate, so it's usually a hit; decoded files serve any context).
- Can't be verified here without a real iPhone: e2e simulates it in Chromium (the page's visibility switched by hand, the context
  suspended or closed).
