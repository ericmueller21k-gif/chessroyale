import { Component, type ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { youngGuest } from "../account.ts";
import { captureError, reportProblem, type ReportKind } from "../problems.ts";
import { FdButton } from "./FrontDoor.tsx";

/**
 * The app's one error boundary, at its root (main.tsx): a render error is reported, and instead of a blank page the
 * player sees "Something went wrong" and a way back in.
 */
export class ErrorBoundary extends Component<{ children: ComponentChildren }, { failed: boolean }> {
  state = { failed: false };

  componentDidCatch(error: unknown) {
    captureError("render", error);
    this.setState({ failed: true });
    // (Still a page error too, as before the boundary: the console and the e2e tests' error checks see it. Reported
    // once: the page's listener skips an error already captured.)
    queueMicrotask(() => {
      throw error;
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div class="screen center crash">
        <h1>Something went wrong</h1>
        <p class="muted">Reload to carry on. We keep a note of errors like this so we can fix them.</p>
        <button type="button" class="btn btn-primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}

/** The feedback sheet's kinds, as its choice shows them; a bug comes with this device's diagnostics. */
const KINDS: { id: ReportKind; emoji: string; label: string; placeholder: string; hint: string; thanks?: string }[] = [
  { id: "bug", emoji: "🐞", label: "Report a bug", placeholder: "What happened? (optional)", hint: "Sent with details of this screen and device, to help us fix it." },
  { id: "feedback", emoji: "💬", label: "Feedback", placeholder: "What do you think?", hint: "Just your note: nothing else is sent.", thanks: "Thanks for your feedback!" },
  { id: "idea", emoji: "💡", label: "Suggest an idea", placeholder: "What's your idea?", hint: "Just your note: nothing else is sent.", thanks: "Thanks for the idea!" },
];

/** The feedback sheet: closed, or open on a kind; kept here so anything can open it (the match menu, Settings). */
let sheet: ReportKind | null = null;
const sheetSeen = new Set<(kind: ReportKind | null) => void>();
export function openReport(kind: ReportKind | null) {
  // (A guest on a device that answered the age question "too young" types nothing to us: a bug report, its diagnostics
  // only. The sheet opens on that kind, whichever was asked for.)
  sheet = kind && youngGuest() ? "bug" : kind;
  for (const f of sheetSeen) f(sheet);
}

/**
 * The feedback sheet, over any screen (main.tsx, beside the ban notice and drawn like it, so a match redrawing its
 * screen with each move never takes the form or the keyboard away): a bug (an optional note, sent with this device's
 * diagnostics: problems.ts), feedback or an idea (a note, alone). The answer for a bug is its short id for the player
 * to pass on.
 */
export function ReportSheet() {
  const [open, setOpen] = useState(sheet);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [answer, setAnswer] = useState<{ id: string } | { error: string } | null>(null);
  const close = () => {
    openReport(null);
    setNote("");
    setAnswer(null);
  };
  useEffect(() => {
    sheetSeen.add(setOpen);
    return () => void sheetSeen.delete(setOpen);
  }, []);
  if (!open) return null;
  const kind = KINDS.find((k) => k.id === open)!;
  const young = youngGuest();
  return (
    <div class="fd-sheet-scrim rp-scrim" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="fd-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-title">
        <div class="fd-sheet-head">
          <h2 id="rp-title">We'd love your feedback</h2>
          <button type="button" class="fd-icon-btn" aria-label="Close" onClick={close}>
            ✕
          </button>
        </div>
        {answer && "id" in answer ? (
          <>
            <p class="rp-id" role="status">
              {kind.thanks ?? (
                <>
                  Report <strong>{answer.id}</strong> — share this id
                </>
              )}
            </p>
            <FdButton primary onClick={close}>
              Done
            </FdButton>
          </>
        ) : (
          <>
            {!young && (
              <>
                <div class="fd-seg three rp-kinds" role="radiogroup" aria-label="What kind">
                  {KINDS.map((k) => (
                    <button
                      type="button"
                      role="radio"
                      key={k.id}
                      aria-checked={k.id === open}
                      class={k.id === open ? "on" : ""}
                      onClick={() => {
                        setAnswer(null);
                        setOpen(k.id);
                      }}
                    >
                      <b aria-hidden="true">{k.emoji}</b>
                      {k.label}
                    </button>
                  ))}
                </div>
                <textarea class="fp-appeal" rows={3} maxLength={500} aria-label={kind.placeholder} placeholder={kind.placeholder} value={note} onInput={(e) => setNote(e.currentTarget.value)} />
              </>
            )}
            <p class="fd-sub">{young ? "Sends details of this screen and device, to help us fix a bug. Nothing you type." : kind.hint}</p>
            {answer && (
              <p class="fd-sub rp-error" role="alert">
                {answer.error}
              </p>
            )}
            <FdButton
              primary
              disabled={sending || (open !== "bug" && !note.trim())}
              onClick={() => {
                setSending(true);
                void reportProblem(open, note).then((a) => {
                  setSending(false);
                  setAnswer(a);
                });
              }}
            >
              {sending ? "Sending…" : "Send"}
            </FdButton>
          </>
        )}
      </div>
    </div>
  );
}
