/**
 * The claw machine in Boingo's Funhouse (Nov 6): a stub. Tapping the machine's coin slot calls this; another helper replaces it
 * with the real machine. Until then it shows a small "Coming soon" card, closed by a tap.
 */
export function openClawMachine(): void {
  if (document.querySelector(".claw-soon")) return;
  const card = document.createElement("div");
  card.className = "claw-soon";
  card.setAttribute("role", "dialog");
  card.style.cssText =
    "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;padding:16px 24px;border-radius:12px;" +
    "background:#2a1640;color:#fff;font:600 16px system-ui,sans-serif;text-align:center;box-shadow:0 6px 24px #0008;cursor:pointer";
  card.innerHTML = '<div style="font-size:18px">Claw machine</div><div style="opacity:.8;margin-top:4px">Coming soon</div>';
  card.addEventListener("click", () => card.remove());
  document.body.appendChild(card);
}
