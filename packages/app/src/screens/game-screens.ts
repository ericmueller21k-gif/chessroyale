// A match's screens, Squads' and 1 v 1's: one chunk, off the first load (Nov 10, phone load: home starts fast). App.tsx
// loads it when play is near (the queue, the boss menu, a match starting: lazy.tsx), so entering a match doesn't wait.
export { FinalScreen } from "./Final.tsx";
export { LobbyScreen } from "./Lobby.tsx";
export { OpeningGrid } from "./OpeningGrid.tsx";
export { PlayScreen } from "./Play.tsx";
export { PhaseChangeScreen, SimulScreen } from "./Recluse2.tsx";
export { RecluseCutscene } from "../components/RecluseCutscene.tsx";
export { ResultsScreen } from "./Results.tsx";
export { RevealScreen } from "./Reveal.tsx";
export { CrowdCut, CrowdReveal, WatchScreen } from "./Crowd.tsx";
export { VoteScreen } from "./Vote.tsx";
export { BossScreen } from "./Boss.tsx";
export { SpectateScreen } from "./Spectate.tsx";
export { StageBreakScreen } from "./StageBreak.tsx";
export { SquadsQueue, SquadsScreen } from "./Squads.tsx";
export { DuelFront } from "./Duel.tsx";
