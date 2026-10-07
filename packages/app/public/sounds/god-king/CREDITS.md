# God King sounds

Short cuts from two CC0 (public domain) packs, trimmed and loudness-matched. Swap any file for another with the
same name to change it; the game plays them at these moments of the God King's animation:

| File | When | Source (CC0) |
|---|---|---|
| summon.mp3 | lightning starts converging | Juhani Junkala, *The Essential Retro Video Game Sound Effects Collection [512 sounds]*, `sfx_movement_portal6` |
| appear.mp3 | the flash: the God King appears | Junkala, `sfx_sounds_fanfare1` |
| hyuah.mp3 | he raises his sword ("hyuah!") | HaelDB, *Male Grunt/Yelling sounds*, `3grunt3` (trimmed, light 16-bit crunch) |
| bolt.mp3 | his bolt strikes | Junkala, `sfx_exp_shortest_hard4` |
| hit.mp3 | the boss loses HP (the last of his three slashes) | Junkala, `sfx_damage_hit3` |
| cutin.mp3 | his cut-in banner sweeps in | A synthesised whoosh into Junkala's `sfx_wpn_sword2` |
| slash.mp3 | each of his three slashes on the boss | Made for the game (a bright noise swish with a metallic ring, synthesised with ffmpeg; no licence needed) |
| leave.mp3 | holy light: he vanishes | Made for the game (a falling three-tone shimmer, synthesised with ffmpeg; no licence needed) |
| warn.mp3 | his Last Stand: the blundered move lands (the red "??" warning) | Junkala, `sfx_lowhealth_alarmloop3` (two beeps, pitched down, light crunch) over `sfx_sounds_impact12` (pitched down, cut short) |
| last-leap.mp3 | his Last Stand: he leaps out of the dock and falls onto the board | Junkala, `sfx_movement_jump19`, then `sfx_sounds_falling3` (sped up, shortened) |
| last-crash.mp3 | he crashes down on the piece's square | Junkala, `sfx_exp_short_hard2` and `sfx_sounds_impact12`, pitched down |
| last-slashes.mp3 | the 25 slashes he takes for the piece | Junkala, `sfx_wpn_sword1` and `sfx_wpn_sword2` (pitch varied) landing with `sfx_damage_hit3`, `5`, `8` and `10` |
| last-grunt1.mp3, last-grunt2.mp3 | grunts of agony under the blows | HaelDB, `3grunt4` and `1yell7` (deeper, light 16-bit crunch) |
| last-groan.mp3 | he collapses: his death groan | HaelDB, `yell3` (deeper and slower, crunch, an echo tail) |

The Last Stand's cuts are made by `scripts/god-king-last-stand-sounds.py` from the two packs.

- https://opengameart.org/content/512-sound-effects-8-bit-style (CC0)
- https://opengameart.org/content/male-gruntyelling-sounds (CC0)
