import { useEffect, useState } from "preact/hooks";
import { isMuted, onMuteChange, setMuted, unlockAudio } from "../sound.ts";

/** Sound on/off, remembered on this device. */
export function MuteButton() {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMuteChange(() => setM(isMuted())), []);
  return (
    <button
      type="button"
      class="mute-btn"
      aria-label={m ? "Turn sound on" : "Turn sound off"}
      title={m ? "Sound off" : "Sound on"}
      onClick={() => {
        unlockAudio();
        setMuted(!m);
      }}
    >
      {m ? "🔇" : "🔊"}
    </button>
  );
}
