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
export { DuelFront, DuelWatch } from "./Duel.tsx";
export { BossStageFigure, prewarmBoss } from "../components/BossStage.tsx";
// (Dash's clock tap: an overlay beside the match's screens, so in this chunk, never the first load: the Nov 19 sweep found its static
// import in App.tsx had pulled every boss's kit back into the entry, undoing the Nov 16 split.)
export { DashTap } from "../components/DashStall.tsx";
