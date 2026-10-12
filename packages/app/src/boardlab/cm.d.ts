// cm-chessboard ships plain JavaScript; the lab only needs these entry points loosely typed.
declare module "cm-chessboard/src/Chessboard.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Chessboard: any;
  export const COLOR: { white: "w"; black: "b" };
  export const INPUT_EVENT_TYPE: Record<"moveInputStarted" | "movingOverSquare" | "validateMoveInput" | "moveInputCanceled" | "moveInputFinished", string>;
  export const BORDER_TYPE: Record<"none" | "thin" | "frame", string>;
}
declare module "cm-chessboard/src/extensions/markers/Markers.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Markers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const MARKER_TYPE: Record<string, any>;
}
