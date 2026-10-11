import { useLayoutEffect, useMemo } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { BackButton } from "../components/FrontDoor.tsx";
import { FAQ_INTRO, faqPage } from "../faq/content.ts";
import type { Block, Inline } from "../faq/markdown.ts";

/**
 * The FAQ, "How HunChess works" (Settings → FAQ · How it works; Eric, Oct 11). Its words and numbers are in
 * `faq/content.ts`; this draws them: the contents with tap-to-jump links, then each section. Anchors on the page are
 * `faq-<id>`, so `/faq#faq-handover` opens at that heading.
 */
const anchor = (id: string) => `faq-${id}`;

/** Scrolls to a section or heading, and keeps it in the address (so the link can be shared). */
function jump(id: string, smooth = true) {
  const el = document.getElementById(anchor(id));
  if (!el) return;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  history.replaceState(null, "", `${location.pathname}${location.search}#${anchor(id)}`);
}

function Link({ href, children }: { href: string; children: ComponentChildren }) {
  if (href.startsWith("#")) {
    const id = href.slice(1);
    return (
      <a
        href={`#${anchor(id)}`}
        onClick={(e) => {
          e.preventDefault();
          jump(id);
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function Text({ parts }: { parts: readonly Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "bold" ? <strong key={i}>{p.text}</strong> : p.kind === "em" ? <em key={i}>{p.text}</em> : p.kind === "link" ? <Link key={i} href={p.href}>{p.text}</Link> : p.text,
      )}
    </>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case "heading":
      return (
        <h3 id={anchor(b.id)} class="faq-h3">
          {b.text}
        </h3>
      );
    case "para":
      return (
        <p>
          <Text parts={b.inlines} />
        </p>
      );
    case "note":
      return (
        <aside class="faq-note">
          <Text parts={b.inlines} />
        </aside>
      );
    case "formula":
      return (
        <div class="faq-formula">
          {b.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      );
    case "list": {
      const items = b.items.map((it, i) => (
        <li key={i}>
          <Text parts={it} />
        </li>
      ));
      return b.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case "table":
      return (
        <div class="faq-table-wrap">
          <table class="faq-table">
            <thead>
              <tr>
                {b.head.map((c, i) => (
                  <th key={i} scope="col">
                    <Text parts={c} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, k) => (
                    <td key={k}>
                      <Text parts={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function FaqScreen({ onBack }: { onBack: () => void }) {
  const page = useMemo(() => faqPage(), []);
  // Opens at the top (Settings may have been scrolled), or at the heading in the address.
  useLayoutEffect(() => {
    const id = location.hash.startsWith("#faq-") ? location.hash.slice(5) : "";
    if (id && document.getElementById(anchor(id))) jump(id, false);
    else window.scrollTo(0, 0);
  }, []);
  return (
    <div class="fd-page fd-faq">
      <header class="fd-page-head">
        <BackButton onClick={onBack} label="Back to Settings" />
        <h1>FAQ · How it works</h1>
        <span class="fd-head-spacer" />
      </header>
      <p class="faq-intro">{FAQ_INTRO}</p>

      <nav class="faq-toc" id={anchor("contents")} aria-label="Contents">
        <h2 class="fd-label">CONTENTS</h2>
        <ol>
          {page.toc.map((t) => (
            <li key={t.id}>
              <Link href={`#${t.id}`}>{t.title}</Link>
              {t.subs.length > 0 && (
                <ul>
                  {t.subs.map((s) => (
                    <li key={s.id}>
                      <Link href={`#${s.id}`}>{s.title}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {page.sections.map((s, i) => (
        <section key={s.id} class="faq-section" aria-labelledby={anchor(s.id)}>
          <h2 id={anchor(s.id)} class="faq-h2">
            <span class="faq-num" aria-hidden="true">
              {i + 1}
            </span>
            {s.title}
          </h2>
          {s.blocks.map((b, k) => (
            <BlockView key={k} b={b} />
          ))}
          <p class="faq-top">
            <Link href="#contents">↑ Contents</Link>
          </p>
        </section>
      ))}
    </div>
  );
}
