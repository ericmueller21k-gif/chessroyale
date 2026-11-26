\version "2.24.0"
% The town's first piano solo (song_ad.py's solo "a"), as the piano plays it in the game: twenty bars at 129.
% Both hands are the soft piano. Left out, because they are not the piano: one bass note under each bar (the bar's
% root, on a bass) and far-off strings under the last four bars.
% Check it against the song's own notes: python3 sheets/check_sheet.py (it reads the MIDI this file writes).
#(set-global-staff-size 21)
\header {
  title = "The Town: Piano Solo A"
  subtitle = "from the HunChess soundtrack"
  tagline = ##f
}
\paper {
  #(set-paper-size "letter")
  top-margin = 14\mm
  bottom-margin = 14\mm
  left-margin = 14\mm
  right-margin = 14\mm
  system-system-spacing.basic-distance = #18
  markup-system-spacing.basic-distance = #18
  ragged-last-bottom = ##f
}

right = \relative c'' {
  \clef treble \key c \major \time 4/4
  \tempo "Even eighths, with pedal" 4 = 129
  % Bars 1-4: the left hand alone.
  R1*4 | \break
  % Bars 5-8
  \acciaccatura d8 e4\mf^\markup { \italic "right hand joins" } b' g8 a e'4 |
  d16 c b a g f e d <g, e'>2 |
  r8 e' a b c4. d8 |
  \tuplet 3/2 { e8 f e } b4 g2 | \break
  % Bars 9-12
  fis'4. e8 d b a4 |
  r8 b d e fis4. e8 |
  \tuplet 3/2 { dis8 e dis } b4 a fis |
  <c e>2 e8 g b e | \break
  % Bars 13-16: the right hand in octaves
  \acciaccatura d,8 <e, e'>4\f^\markup { \italic "again, in octaves" } <b' b'> <g g'>8 <a a'> <e' e'>4 |
  <d d'>4 <b b'>8 <g g'> <e g e'>2 |
  r8 <e e'> <a a'> <b b'> <c c'>4. <d d'>8 |
  \tuplet 3/2 { <e e'>8 <f f'> <e e'> } <b b'>4 <g g'>2 | \break
  % Bars 17-20
  <fis' fis'>4. <e e'>8 <d d'> <b b'> <a a'>4 |
  r8 <b b'> <d d'> <e e'> <fis fis'>4. <e e'>8 |
  \tuplet 3/2 { <dis dis'>8 <e e'> <dis dis'> } <b b'>4 <a a'> <fis fis'> |
  <e c' e>2 <e e'>8 <g g'> <b b'> <e e'> |
  \bar "|."
}

left = {
  \clef bass \key c \major \time 4/4
  % Bars 1-4: his first pattern
  c,8\p^\markup { \italic "left hand alone" } g, d e g e d g, |
  c,8 g, e f g f e g, |
  a,8 e b c' e' c' b e |
  f,8 c g a e' c' a g |
  % Bars 5-6: the first two bars an octave up
  \clef treble
  c8_\markup { \italic "an octave higher" } g d' e' g' e' d' g |
  c8 g e' f' g' f' e' g |
  % Bars 7-8
  \clef bass
  a,8 e b c' e' c' b e |
  f,8 c g a e' c' a g |
  % Bars 9-12: his second pattern, with its black keys
  c8 fis a b d' b a fis |
  c8 fis a b e' d' b a |
  c8 dis a b c' b a dis |
  b,8 e g a b a g e |
  % Bars 13-16
  c,8 g, d e g e d g, |
  c,8 g, e f g f e g, |
  a,8 e b c' e' c' b e |
  f,8 c g a e' c' a g |
  % Bars 17-20
  c8 fis a b d' b a fis |
  c8 fis a b e' d' b a |
  c8 dis a b c' b a dis |
  b,8 e g a b a g e |
  \bar "|."
}

\score {
  \new PianoStaff <<
    \new Staff = "right" \right
    \new Staff = "left" \left
  >>
  \layout {
    \context { \Score \override BarNumber.break-visibility = ##(#f #t #t) barNumberVisibility = #all-bar-numbers-visible \override BarNumber.font-size = #-1 }
  }
  \midi { }
}
\markup {
  \vspace #1
  \column {
    \line { \italic "Both hands are the same soft piano. In the game a bass also plays one low note under each bar" }
    \line { \italic "(the bar's root: C, C, A, F and so on) and quiet strings join for the last four bars; they are not written here." }
  }
}
