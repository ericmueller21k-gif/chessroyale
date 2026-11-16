import { useRef } from "preact/hooks";
import { QUICK_CHAT } from "@chessroyale/core";
import type { MatchChat } from "../chat.ts";
import type { QueueView } from "../screens/Queue.tsx";
import { ChatPanel, type ChatPeople } from "./QuickChat.tsx";

/**
 * Quick chat in the lobby, while the match fills (the queue, a private lobby, Solo's queue with its bots): one
 * channel for everyone there ("Lobby"), with the same lines, picks, limits, mute and chat off as in the match (see
 * DECISIONS.md, "Lobby chat"). Its lines stay in the match's feed once teams begin.
 *
 * Self-contained, for whichever screen places it: it takes its size from the box it's put in (it grows into the room
 * it's given, and shows at least QUICK_CHAT.lobbyFeedLines lines), with no fixed positioning. Nothing shows where the
 * match has no chat (Classic).
 */
export function LobbyChat({ match }: { match: QueueView & { readonly chat?: MatchChat } }) {
  const chat = match.chat;
  // Everyone seen in the lobby, kept after they leave, so a line they said keeps its name.
  const names = useRef(new Map<string, string>());
  for (const p of match.players) names.current.set(p.id, p.name);
  // (Shown as soon as the queue is, before the server has opened chat: its buttons wait, so nothing jumps.)
  if (!chat || (!chat.enabled && match.settings.mode !== "crowd")) return null;
  const people: ChatPeople = {
    nameOf: (id) => names.current.get(id) ?? "Someone",
    isYou: (id) => id === match.myId,
    who: (id) => {
      const p = match.players.find((x) => x.id === id);
      return p ? { isBot: p.isBot, uid: p.uid, team: null } : undefined;
    },
  };
  return (
    <div class="lchat" style={{ "--lines": QUICK_CHAT.lobbyFeedLines }}>
      <ChatPanel people={people} chat={chat} variant="lobby" />
    </div>
  );
}
