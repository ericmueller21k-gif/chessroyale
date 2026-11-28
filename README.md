# Town phase 2: the text-size stills (for the director, before the one-size text is kept)

The town's name tags and a home's name at every zoom step, on a phone (iPhone 13, the canvas at 2x) and a computer (1280 x 800, 1x):
before (a picture for every size: five a tag, nine a name), new with one size (a tag's picture made at 12 px, a name's at 20, scaled by
the GPU), new with two sizes (9 and 12; 14 and 20). Each row says the sizes the text is drawn at. The phone's crops are the screen's own
pixels; the computer's are 3 times over (nearest), so a pixel can be seen.

- `text-tags-phone.png`, `text-names-phone.png`
- `text-tags-computer.png`, `text-names-computer.png`
- `text-smallest-tags-computer-7x.png`: the hardest case, the smallest tags (8 px) on the 1x computer, 7 times over: before, one size, two sizes.

My reading: on the phone the three can't be told apart. On the 1x computer the smallest tags (8 px) are a touch softer with one size
(the strokes a little dimmer), and two sizes doesn't improve them (9 scaled to 8 is as soft as 12 scaled to 8); the names read the same.
So the branch ships one size. Two sizes is one line each in `packages/app/src/town/feel.ts`: `tagPicSizes: [9, 12]`, `namePicSizes: [14, 20]`.
