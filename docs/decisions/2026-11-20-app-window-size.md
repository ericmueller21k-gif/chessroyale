# The installed app opens at a computer size (Nov 20, 2026)

Eric, Nov 20: the app installed from the browser opened "really narrow" and took the phone layout; it should default to about 1600 wide.

- The manifest can't set a window size, so on its first launch on a computer (installed, fine pointer) the app calls `resizeTo` to
  `APP_WINDOW` (1600 x 900, clamped to the screen) and centers. Once only (a localStorage flag set first): the player's own size sticks.
- Phones, tablets and tabs are left alone. A browser that refuses to resize changes nothing. Lane: targeted (small logic, a unit test).
