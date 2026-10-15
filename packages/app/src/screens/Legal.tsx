import type { ComponentChildren } from "preact";
import { FAIRPLAY, FRIENDS, GLOBAL_CHAT, LOBBY_LIFE } from "@chessroyale/core";

/**
 * The privacy policy (/privacy), terms of service (/terms) and copyright page (/copyright): drafts written from what
 * the code does, until Eric and a lawyer have reviewed them (DECISIONS.md, "Privacy policy and terms: drafts from the code"). Plain words, short
 * sections. Numbers that live in settings.ts are read from there; the cookie lifetimes are the server's (api.ts,
 * accounts.ts). A PR that changes what the game stores changes these words too.
 */

/** The contact address: a placeholder until Eric sets up its forwarding (ROADMAP.md, "Needs Eric"). */
export const CONTACT = "privacy@hunchess.com";
export const UPDATED = "October 15, 2026";

const hours = (ms: number) => Math.round(ms / 3_600_000);
/** The report sheet's reason for a name or icon. */
const OFFENSIVE = FAIRPLAY.reports.reasons.find((r) => r.startsWith("Offensive")) ?? "Offensive name or icon";

/** Words still to be decided, in brackets so nobody takes them for final. */
const Blank = ({ children }: { children: ComponentChildren }) => <span class="legal-blank">[{children}]</span>;

const Mail = () => <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

/** The draft notice and the decisions only Eric or a lawyer can make: the top of every legal page. */
function Draft() {
  return (
    <section class="legal-draft" aria-labelledby="legal-draft-title">
      <h2 id="legal-draft-title">DRAFT — not yet reviewed</h2>
      <p>
        Written from what HunChess does today. It isn't final until Eric and a lawyer have reviewed it. Words in [brackets] are
        placeholders.
      </p>
      <h3>To decide before it's final</h3>
      <ol>
        <li>
          <strong>Who runs HunChess:</strong> you or a company, and a postal address (a P.O. box or mail service is fine) (Eric).
        </li>
        <li>
          <strong>The contact address:</strong> {CONTACT} has to reach a real inbox, or another address goes here (Eric).
        </li>
        <li>
          <strong>Minimum age</strong> (proposed below, not built yet): 13, asked as a neutral birth month and year before signing
          in, choosing a name or drawing an icon; under 13, guest play only, with a default name (Eric; a lawyer to confirm, with
          the EU's and UK's ages).
        </li>
        <li>
          <strong>Governing law:</strong> your state, and courts or arbitration for disputes (Eric; arbitration is a lawyer's call).
        </li>
        <li>
          <strong>A DMCA agent:</strong> registered with the US Copyright Office ($6, renewed every 3 years), its details on the
          copyright page (Eric).
        </li>
        <li>
          <strong>Real-money purchases:</strong> none today. If coins, crates or items are ever sold, the terms need refund and
          consumer-law sections first, and paid crates need a legal check country by country, since some countries treat them as
          gambling (Eric).
        </li>
        <li>
          <strong>EU and UK players:</strong> the wording of the legal bases and the transfer to the US, whether to appoint EU and UK
          representatives, and the UK Online Safety Act's short risk assessments (a lawyer).
        </li>
        <li>
          <strong>How long fair-play records are kept:</strong> today with no end date while the account exists, and a ban's
          record, with its hashed email or Google id, even after the account is deleted (Eric, a lawyer).
        </li>
      </ol>
    </section>
  );
}

/** One kind of data: what it is, why we keep it, and for how long. */
function Item({ title, what, why, kept }: { title: string; what: ComponentChildren; why: ComponentChildren; kept: ComponentChildren }) {
  return (
    <div class="legal-item">
      <h3>{title}</h3>
      {what}
      <p>
        <strong>Why:</strong> {why}
      </p>
      <p>
        <strong>Kept:</strong> {kept}
      </p>
    </div>
  );
}

function Privacy() {
  return (
    <>
      <h2>Who we are</h2>
      <p>
        HunChess is run by <Blank>name of the person or company</Blank>, <Blank>postal address</Blank>, who decides how your data is
        used (the "controller" under EU and UK law). Questions about your data: <Mail />.
      </p>

      <h2>In short</h2>
      <ul>
        <li>No ads, no ad tracking and no analytics services. We never sell your data.</li>
        <li>Guests play solo against bots without signing in: no email, no Google account.</li>
        <li>Your email is for signing in and for fair-play notices. Never newsletters.</li>
        <li>Everything is stored by Cloudflare, which hosts the game.</li>
        <li>Download your data or delete your account any time, in Settings.</li>
      </ul>

      <h2>What we keep, why, and for how long</h2>
      <Item
        title="Your account"
        what={
          <p>
            A random account id, your display name, your icon (an emoji or a drawing you make), and when you joined. If you sign in:
            your email address, or your Google account id and the email Google has verified. There's no password to keep.
          </p>
        }
        why="to run your account and keep your profile on every device you sign in on."
        kept={
          <>
            until you delete your account. A new account is called "Player" until you pick a name: we never take one from your
            Google account or your email.
          </>
        }
      />
      <Item
        title="Staying signed in"
        what={<p>A sign-in session for each device, stored only as a hash, and the cookie that holds it.</p>}
        why="so you don't have to sign in every time."
        kept="a year, or until you sign out on that device."
      />
      <Item
        title="Sign-in codes"
        what={<p>Your email address, the code (stored only as a hash), when it was sent, and how many tries and sends it has had.</p>}
        why="to check the code, and to stop abuse (5 tries a code, 5 codes an hour)."
        kept="an hour after the code was sent."
      />
      <Item
        title="Matches and stats"
        what={
          <p>
            For each match: the mode, your placement and the number of players, your team and whether it won, your scores and stats
            (best move, cuts and strikes survived, the boss you met), your rating after it, the date, the match code, whether it
            counted for ranking, and whether your eval bar was on. Solo results are sent by your device.
          </p>
        }
        why="your profile, stats, rating and rank, and balancing the game (for example, how often each boss wins)."
        kept="with your account. If you delete it, your results stay without anything that leads back to you (below)."
      />
      <Item
        title="Online now and last seen"
        what={<p>When your app last checked in. It checks in every few seconds while it's open.</p>}
        why={'the "online" count on the home screen, "Online now" or "last seen" on your profile, and whether your friends see you online.'}
        kept="only the latest time, written over about once a minute. Whether you're in a match is never written down: it's kept in memory while you're online."
      />
      <Item
        title="Your locker, coins and shop"
        what={
          <p>
            The crate items you own (each with its color, purity and pattern), what you wear, your coins and earned crates, your shop
            items, and the quick-chat lines you picked.
          </p>
        }
        why="so what you own is yours on every device."
        kept="until you delete an item or the account is deleted."
      />
      <Item
        title="Chat"
        what={
          <>
            <p>
              Chat is preset lines and emoji: there's no typing. Lines in a match go to its players and stay with the match until its
              lobby closes, up to {LOBBY_LIFE.lobbyResultsKeepMinutes} minutes after the end. Lines in the home page's global chat carry
              your name, rating and icon.
            </p>
            <p>
              Being built, chat moderation: reporting a message keeps that message, who sent it, who reported it, where and when, and
              a few messages around it. A chat ban or mute keeps the account, until when, and why. Muting a player is kept on your
              device only.
            </p>
          </>
        }
        why="to pass your lines to other players, and to deal with reports."
        kept={
          <>
            global chat keeps its last {GLOBAL_CHAT.keep} lines and shows none older than {hours(GLOBAL_CHAT.maxAgeMs)} hours. Reports,
            bans and mutes: <Blank>set when chat moderation ships</Blank>.
          </>
        }
      />
      <Item
        title="Fair play"
        what={
          <ul>
            <li>
              Every judged move in your online matches: the position, your move, how it compares with the engine's best and with
              the other players' picks, how long you took, and how often the page was hidden while your clock ran.
            </li>
            <li>A short summary of each online match: how strong your moves were, and a fair-play score.</li>
            <li>Reports you make and reports about you: the reason and the match.</li>
            <li>If we look into your account: its status, each decision and why, and any appeal you send with our reply.</li>
            <li>A random device marker (a cookie), with the accounts that played online from that device.</li>
            <li>If you're banned: a hash of your email address or Google id, so a new account made with it is banned too.</li>
          </ul>
        }
        why="to keep online matches fair. A report never bans anyone by itself, and borderline cases go to a person."
        kept={
          <>
            judged moves for {FAIRPLAY.evidenceDaysUnflagged} days, or {FAIRPLAY.evidenceDays} days if you were reported or flagged,
            and longer only while a review of your account is open. The rest until you delete your account, except a ban, which
            stays (below).
          </>
        }
      />
      <Item
        title="Scoring moves on players' devices"
        what={
          <p>
            In online matches, players' browsers score the positions (the Stockfish engine runs in your browser). Your device gets
            positions and picks, never names. For that match only, we note whether your device is a phone or a computer and how fast
            its engine runs. Some positions go to our engine server for a deeper look: positions and moves only.
          </p>
        }
        why="fair, fast scoring without running servers we don't need."
        kept="the device facts only while the match runs."
      />
      <Item
        title={'Error reports and "Report a problem" (being built)'}
        what={
          <p>
            What went wrong (the error and where in the app), the app's version, the screen, mode and boss, the match code, device
            facts (your browser and system as its user agent gives them, your screen size and a rough memory class), the last 20 or
            so things the app did (never chat or anything you typed), your account id if you're signed in, and for "Report a
            problem", the note you choose to write. Never your IP address.
          </p>
        }
        why="to find and fix bugs."
        kept={<Blank>set when error reports ship</Blank>}
      />
      <Item
        title="Friends"
        what={
          <p>
            Your friends, friend requests waiting for an answer, the players you block, your settings for who may invite you and
            whether others see when you're online, game invites to you, and counts that limit how many requests and invites you send.
          </p>
        }
        why="so you can add friends and invite players to your games, and keep away from players you block."
        kept={`friends and blocks until you remove them or the account is deleted; a request until it's answered, or ${FRIENDS.requestDays} days; an invite ${FRIENDS.inviteMinutes} minutes; the counts a day.`}
      />

      <h2>What other players see</h2>
      <p>
        Your profile: your name, the items you wear, when you joined, "Online now" or when you were last seen (unless you hide it in
        Settings), your rating, rank and "Top %", your stats and last 10 matches (only their day while you hide when you're
        online), and "Banned" if you are. Your friends also see whether you're online or in a match, unless you hide it. Nobody
        sees who you've blocked. Never your email or how you sign in. In matches and chat,
        players see your name, icon, look and rating, and your picks.
      </p>

      <h2>Why we're allowed to</h2>
      <p>For players in the EU and UK, the legal reasons:</p>
      <ul>
        <li>
          <strong>Running the game and your account</strong> (your account, matches, locker, chat, sign-in emails): it's what you
          asked for when you started playing.
        </li>
        <li>
          <strong>Fair play, security and fixing bugs:</strong> our legitimate interest, and every player's, in a fair game that
          works. You can object (below).
        </li>
      </ul>

      <h2>Cookies and storage on your device</h2>
      <p>
        Only what the game needs to work: signing in, and fair play's device marker against ban dodging. Nothing for advertising
        or analytics and nothing from other companies, so there's nothing to accept.
      </p>
      <ul>
        <li>
          <strong>hc_session</strong> keeps you signed in. A year.
        </li>
        <li>
          <strong>hc_device</strong> is the fair-play device marker: a random value and nothing else. 400 days.
        </li>
        <li>
          <strong>hc_oauth</strong> and <strong>hc_next</strong> exist only during "Continue with Google". 10 minutes.
        </li>
        <li>
          <strong>Local storage</strong> keeps your settings and choices on this device: theme, sound, eval bar, chat on or off,
          players you muted, your boss picks, and the match you're in, so you can rejoin it.
        </li>
        <li>
          <strong>The app's files</strong> are kept on your device (a service worker) so it opens quickly. No personal data.
        </li>
      </ul>

      <h2>Who else handles your data</h2>
      <ul>
        <li>
          <strong>Cloudflare</strong> hosts the game and stores everything above, in the United States and on its servers in other
          countries.
          Like any web host, it sees your IP address to deliver the game and keeps short-lived request logs. We use your IP address
          only for a moment, in memory, to limit abuse, and never store it.
        </li>
        <li>
          <strong>Google</strong>, only if you choose "Continue with Google": you sign in on Google's page, and Google tells us your
          account id and verified email.
        </li>
        <li>
          <strong>Resend</strong> sends our emails (sign-in codes and fair-play notices). It gets your email address and the message.
        </li>
      </ul>
      <p>
        We share data only when the law requires it. We never sell it or share it for advertising. For EU and UK players, your data
        goes to the United States under <Blank>the safeguards a lawyer names</Blank>.
      </p>

      <h2>Children</h2>
      <p>
        HunChess is a game for a general audience, not directed to children under 13. If we learn we have personal information
        from a child under 13, we delete it. Parents: email <Mail />.
      </p>
      <p>
        <Blank>Proposed, for Eric to decide</Blank> Before you sign in, choose a name or draw an icon, we ask your birth month and
        year. Under 13, you play as a guest with a default name: no sign-in, no email, and no name or drawing of your own.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>
          <strong>See it, or get a copy:</strong> Settings → Download my data gives you a file (JSON) of everything we keep about your
          account. Fair play's detection records aren't in it, as they'd show how cheating is found: email <Mail /> for those, and
          a person answers.
        </li>
        <li>
          <strong>Correct it:</strong> change your name and icon in your profile, or email us.
        </li>
        <li>
          <strong>Delete it:</strong> Settings → Delete account (below), or email <Mail />.
        </li>
        <li>
          <strong>Object or restrict:</strong> ask us to stop or limit a use of your data, such as one based on our legitimate
          interest.
        </li>
        <li>
          <strong>Complain:</strong> to your data protection authority, if you're in the EU or UK.
        </li>
      </ul>
      <p>We answer within 30 days.</p>

      <h2>Deleting your account</h2>
      <p>Settings → Delete account, after a confirmation. It can't be undone.</p>
      <ul>
        <li>
          <strong>Deleted:</strong> your account (name, icon, email or Google id, when you joined and were last seen), every
          sign-in session (you're signed out on every device), your sign-in code's record, your items, coins, crates and shop
          items, your quick-chat picks, reports you made and reports about you, fair play's records about you, your friends,
          requests, blocks and invites (from the other players' lists too), and your lines in the global chat.
        </li>
        <li>
          <strong>Kept, without you:</strong> your match results, moved to one shared "deleted" account with their match codes
          removed, so nothing leads back to you and the game's numbers stay right.
        </li>
        <li>
          <strong>Kept if you're banned:</strong> the ban's record (its decisions and why), the hash of your email or Google id,
          and the device markers, under your old account's random id, so a new account can't get around the ban. Nothing else.
        </li>
        <li>
          <strong>A match you're in</strong> shows your name to its players until it closes (at most{" "}
          {LOBBY_LIFE.lobbyResultsKeepMinutes} minutes after it ends), and records nothing for you.
        </li>
        <li>
          <strong>This device</strong> forgets you too: the app clears its settings and choices.
        </li>
      </ul>

      <h2>Changes</h2>
      <p>We'll update this page and its date. For a big change, we'll tell you in the game first.</p>

      <h2>Contact</h2>
      <p>
        <Mail />
      </p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h2>The basics</h2>
      <p>
        These terms are between you and <Blank>name of the person or company</Blank> ("we"), who run HunChess. By playing, you agree to them. If you
        don't, please don't play. How we handle your data is in the <a href="/privacy">privacy policy</a>.
      </p>

      <h2>Who can play</h2>
      <p>
        You must be 13 or older, or the minimum age where you live if it's higher. One account per person.{" "}
        <Blank>Proposed, for Eric to decide</Blank> Under 13, you play as a guest only, with a default name.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You can play solo as a guest. Online play needs you to sign in, with Google or a code we email you.</li>
        <li>Keep your sign-in to yourself. You're responsible for what's played on your account.</li>
        <li>You can stop playing at any time, and delete your account in Settings.</li>
      </ul>

      <h2>Fair play</h2>
      <ul>
        <li>
          No engines, bots, other devices or anyone else's help picking your moves in online matches. Our testers' practice mode is
          allowed: it's marked, and practice never counts toward a ranking.
        </li>
        <li>No second accounts to get around a ban, and no arranging results with other players.</li>
        <li>Don't exploit bugs. Report them.</li>
        <li>
          We check online moves for engine help. While an account is under review, its online results are held off the rankings. A ban
          stops online play; solo games against bots stay open. Borderline cases go to a person, and you can appeal a ban.
        </li>
      </ul>

      <h2>Conduct and chat</h2>
      <ul>
        <li>Chat is preset lines and emoji. Don't use them to harass anyone or to spam.</li>
        <li>Don't attack, overload or scrape the game, and don't play with bots or scripts.</li>
        <li>We can mute you, or suspend or remove an account that breaks these terms. To report a player, tap their name.</li>
      </ul>

      <h2>Virtual items</h2>
      <ul>
        <li>Crates, coins, items, God King effects and chat packs are cosmetic. They never change how a match is played or scored.</li>
        <li>They have no cash value, and they can't be sold, traded or exchanged for money, in the game or outside it.</li>
        <li>You get a license to use them in the game, not ownership. They go when your account is deleted.</li>
        <li>Every crate's odds are in the FAQ (Crates and items), and crates are opened by our server, never your device.</li>
        <li>Today items are earned or free, never bought with real money. If that changes, these terms will cover purchases first.</li>
        <li>We may change or retire items, and items, coins and stats from the testing period may be reset at launch.</li>
      </ul>

      <h2>Names and drawn icons</h2>
      <ul>
        <li>
          No personal information, yours or anyone's: no full real names, phone numbers, addresses, emails or social media
          handles.
        </li>
        <li>Nothing offensive, hateful, sexual or harassing.</li>
        <li>No one else's trademarks, logos, characters or art.</li>
        <li>Don't pretend to be someone else: another player, a famous person, or us.</li>
        <li>
          Your drawings are yours. You give us a free, worldwide license to store your name and icon and show them in the game for
          as long as they're on your account.
        </li>
        <li>
          We can rename you or reset your icon if they break these rules. To report one, tap the player's name and
          choose "{OFFENSIVE}".
        </li>
      </ul>

      <h2>Copyright</h2>
      <p>
        If a name or icon in HunChess copies your work, follow the steps on our <a href="/copyright">copyright page</a>. We take down
        what infringes, and we close the accounts of repeat infringers.
      </p>

      <h2>The game can change</h2>
      <p>
        HunChess is free and still growing. We may change its rules, modes, ratings and features, reset ratings or stats, or pause or
        end the game. For a big change, we'll tell you in the game first when we can.
      </p>

      <h2>Not affiliated</h2>
      <p>
        HunChess isn't affiliated with or endorsed by FIDE, Chess.com, Lichess, or any other real person or organization. Its
        characters are fictional.
      </p>

      <h2>Open-source parts</h2>
      <p>
        Stockfish (GPL-3.0) and Maia-3 (AGPL-3.0) run in your browser as separate programs under their own licenses, linked in
        Settings and the FAQ. Nothing here limits your rights under those licenses.
      </p>

      <h2>No warranty, limited liability</h2>
      <p>
        HunChess is provided as it is, without warranties. As far as the law allows, we aren't liable for indirect losses, for lost
        stats or items, or for what other players do, and our total liability is limited to <Blank>amount</Blank>. Nothing here takes
        away rights you have as a consumer where you live.
      </p>

      <h2>Ending</h2>
      <p>
        You can stop at any time. We can suspend or end your access if you break these terms, and we'll tell you why unless the law
        or someone's safety stops us.
      </p>

      <h2>Changes to these terms</h2>
      <p>We'll post changes here with a new date, and tell you in the game for big ones. Playing after a change means you accept it.</p>

      <h2>Governing law</h2>
      <p>
        The law of <Blank>state</Blank> governs these terms, and disputes go to <Blank>its courts, or arbitration</Blank>,
        except where your own consumer law says otherwise.
      </p>

      <h2>Contact</h2>
      <p>
        <Mail />
      </p>
    </>
  );
}

function Copyright() {
  return (
    <>
      <p>
        Players show two things others can see: a display name and a drawn icon. If you believe one copies your copyrighted work,
        send a notice to our designated agent.
      </p>

      <h2>Our designated agent</h2>
      <p>
        <Blank>name</Blank>, <Blank>postal address</Blank>, <Blank>email</Blank>, <Blank>phone</Blank>. Registered with the US Copyright
        Office: <Blank>registration number</Blank>.
      </p>

      <h2>What a notice needs</h2>
      <ol>
        <li>Your physical or electronic signature.</li>
        <li>The copyrighted work you say was copied.</li>
        <li>The name or icon that copies it, and where it appears (the player's name, or a link to their profile).</li>
        <li>Your name, postal address, phone number and email.</li>
        <li>A statement that you believe in good faith the use isn't allowed by the copyright's owner, its agent or the law.</li>
        <li>
          A statement that the notice is accurate and, under penalty of perjury, that you own the copyright or may act for its
          owner.
        </li>
      </ol>

      <h2>What we do</h2>
      <p>We reset the icon or rename the player, and tell them, with a copy of the notice.</p>

      <h2>If yours was taken down by mistake</h2>
      <p>Send our agent a counter-notice with:</p>
      <ol>
        <li>Your physical or electronic signature.</li>
        <li>What was taken down, and where it appeared.</li>
        <li>
          A statement, under penalty of perjury, that you believe in good faith it was taken down by mistake or because it was
          misidentified.
        </li>
        <li>
          Your name, postal address and phone number; that you consent to the jurisdiction of the federal district court for your
          address (outside the US, any district where we can be found); and that you'll accept service from the person who sent
          the notice.
        </li>
      </ol>
      <p>
        We pass it on to them and put your name or icon back in 10 to 14 business days, unless they tell us they've gone to court.
      </p>

      <h2>Repeat infringers</h2>
      <p>We close the accounts of players who infringe again and again.</p>

      <h2>Anything else</h2>
      <p>
        For a name or icon that's offensive but not a copyright matter, tap the player's name and report it. The open-source
        software in the game is credited in Settings and the FAQ. Other questions: <Mail />.
      </p>
    </>
  );
}

export type LegalPage = "privacy" | "terms" | "copyright";
const TITLES: Record<LegalPage, string> = { privacy: "Privacy policy", terms: "Terms of service", copyright: "Copyright" };

/** Which legal page an address shows (null: none). */
export const legalPageOf = (path: string): LegalPage | null => (path === "/privacy" || path === "/terms" || path === "/copyright" ? (path.slice(1) as LegalPage) : null);

/** A legal page: the draft notice first, then the page, then links to the other two. */
export function LegalScreen({ page, onBack }: { page: LegalPage; onBack: () => void }) {
  return (
    <div class="screen legal">
      <h1>{TITLES[page]}</h1>
      <p class="muted small">Last updated {UPDATED} (draft)</p>
      <Draft />
      {page === "privacy" ? <Privacy /> : page === "terms" ? <Terms /> : <Copyright />}
      <p class="legal-other">
        {(Object.keys(TITLES) as LegalPage[])
          .filter((p) => p !== page)
          .map((p) => (
            <a key={p} href={`/${p}`}>
              {TITLES[p]}
            </a>
          ))}
      </p>
      <button type="button" class="btn btn-secondary" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

/**
 * Back from a legal page. Every link here is a plain link (a page load), from the landing page, Settings, the FAQ or
 * the other legal page, so back is the browser's back to it; opened any other way (typed, or from another site), home.
 */
export function leaveLegal(close: () => void) {
  let fromHere = false;
  try {
    fromHere = history.length > 1 && !!document.referrer && new URL(document.referrer).origin === location.origin;
  } catch {
    // No referrer to read.
  }
  if (fromHere) {
    history.back();
    return;
  }
  close();
  history.replaceState(null, "", "/");
}
