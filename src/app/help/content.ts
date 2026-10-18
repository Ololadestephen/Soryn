export interface HelpSection {
  id: string;
  title: string;
  intro: string;
  questions: { question: string; answer: string }[];
}

export const helpSections: readonly HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    intro: "Your first visit to the arena.",
    questions: [
      {
        question: "What is Soryn?",
        answer:
          "Soryn is a browser tactical creature battler. Choose a fighter and their companion, then use attacks, defence and special abilities in turn-based combat. Practice is against the computer; Find a Match, Challenge a Friend and Story are separate modes. The characters and sanctuary are Soryn fiction, not official Chog or Monad lore.",
      },
      {
        question: "How do I play for the first time?",
        answer:
          "Select Play now, then Practice. Choose your fighter, computer opponent, difficulty and arena, then enter the guest arena. Read Fighter & ability details before you start. Pip, Bolt, Patch and Moss are the four guest starters. You can learn the controls without a wallet or token purchase.",
      },
      {
        question: "Do I need an account, wallet or download?",
        answer:
          "Guest Practice runs in your browser without wallet sign-in or an app download. Wallet-based modes use Privy sign-in and a separate access check. Guest progress and authenticated wallet records are different identities; connecting a wallet does not automatically convert a guest battle into official NFT history.",
      },
      {
        question: "Can I play on a phone?",
        answer:
          "The interface supports desktop and portrait mobile layouts, with on-screen move buttons rather than a keyboard requirement. Keep your browser up to date and use a stable connection. Some devices may show a static background or lower animation performance; a desktop browser can help when troubleshooting. Mobile layout support is not a guarantee that every browser or device has been tested.",
      },
      {
        question: "Where are the other pages?",
        answer:
          "Play now opens the four main modes. Fighters on the homepage previews the roster; My Chog handles verified identity; Battle History is in More or the mobile Menu. The Archive links to earlier adventure experiences. These are separate from the current combat Story and its progress.",
      },
    ],
  },
  {
    id: "access-wallets",
    title: "Access & wallets",
    intro: "What unlocks a mode, and what signing means.",
    questions: [
      {
        question: "Which modes are free, and which require holdings?",
        answer:
          "Guest Practice is available without holdings. The holder-access policy for Story and player battles requires at least 50 $CHOG or a qualifying Chog NFT on Monad Mainnet. These holdings are checked, not spent. Holder access can be paused by the operator; a qualifying wallet does not override a paused service. Practice and existing records remain available during that pause.",
      },
      {
        question: "Do more tokens make my fighter stronger?",
        answer:
          "Your wallet balance does not increase damage, health or initiative. Holdings unlock access and eligible fighters; each fighter has their own displayed stats, moves and passives. The roster is not a promise that all fighters have identical stats. Holding both assets does not multiply combat stats.",
      },
      {
        question: "Which fighters can my wallet use?",
        answer:
          "The token-holder path adds Aegis and Nyx to the four starters. Verified Chog Genesis ownership unlocks the additional holder roster. The server determines your current eligible choices; the public match roster is restricted separately from private rooms and holder Practice. A homepage preview is not proof that a fighter is unlocked for your identity or mode.",
      },
      {
        question: "Which chain and NFT collection are recognized?",
        answer:
          "The verified NFT identity is Chog Genesis on Monad Mainnet, chain ID 143, at contract 0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763. An NFT display name is not its token ID: CHOG #1737, for example, is token ID 276. Use the identity verified in My Chog rather than guessing IDs from names. Collection metadata is not a license to reuse its artwork.",
      },
      {
        question: "How do I sign in, and why is a signature requested?",
        answer:
          "Use Connect wallet to open Privy, then follow the in-app authentication steps. A login or identity signature establishes control for this app; it is bound to a wallet, origin, nonce and expiry. Review the exact message in your wallet. Expired or already-used challenges must be replaced with a fresh one. Do not sign a message you do not understand.",
      },
      {
        question: "Does Soryn need my seed phrase or a transaction?",
        answer:
          "No one supporting this app needs your seed phrase, private key or recovery codes. The current gameplay access flow does not require an NFT transfer, token approval, stake, bet or gameplay payment transaction. A wallet authentication signature is different from an on-chain transfer. If an unexpected approval or transaction request appears, stop and verify what opened it.",
      },
      {
        question: "Why are my holdings checked again?",
        answer:
          "A previous session is not permanent proof of ownership. The server refreshes access at admission boundaries, and official NFT actions require current-owner evidence. If the RPC provider is unavailable or evidence is stale, protected actions fail closed. Try again after the service recovers; repeated signatures cannot repair an unavailable chain provider.",
      },
      {
        question: "What happens if an NFT is transferred away, then back?",
        answer:
          "The old owner loses authority to make new official writes when an ownership change is detected. Previous ownership grants do not automatically become valid again after a transfer back; fresh ownership-generation checks are required. Public token history can remain with the NFT identity, while the previous keeper’s private drafts, wallet sessions and private Story progress stay private.",
      },
    ],
  },
  {
    id: "combat",
    title: "Fighters & combat",
    intro: "Understand the round before choosing a move.",
    questions: [
      {
        question: "What can I do each round?",
        answer:
          "Choose Basic attack, Defence or your fighter’s Special. Read the move labels and Fighter & ability details for that fighter’s costs, effects and passive. In player battles, moves are selected privately and the server resolves them after the required selections or deadline. The combat animation shows that resolved outcome; animation timing does not decide damage.",
      },
      {
        question: "How do energy and cooldowns work?",
        answer:
          "A fighter starts with 4 energy and has a cap of 6. A move’s cost is paid when the round locks. Surviving fighters recover energy between continuing rounds; Bolt gains extra recovery when guarding. Specials also have a cooldown measured in following rounds. The move button shows whether a special is ready, cooling down or blocked by a status effect. Defence costs no energy.",
      },
      {
        question: "Why did my opponent act first?",
        answer:
          "Initiative combines fighter speed with the selected move’s initiative bonus and applicable fighter rules. Ties follow a deterministic alternating order; faster clicking does not break them. Defence prepares its protection before attacks resolve. A knockout cancels an attack that has not yet occurred, so a defeated fighter cannot land a late strike.",
      },
      {
        question: "Does Defence block everything or always counterattack?",
        answer:
          "No. Defence prepares the fighter’s listed shield, and passives can add effects such as healing, recovery, a dodge or a counter. Armour, exposure and the incoming ability also affect the result. Aegis’s guard counter is a fighter-specific rule, not a universal response to every hit. Check the battle history to see what actually resolved.",
      },
      {
        question: "How do companions and special abilities work?",
        answer:
          "Each fighter has a paired companion. Their special can attack, shield, heal or apply effects according to the displayed rules. The companion is part of that coordinated ability, not a second independently controlled unit. Preview animations on the homepage illustrate an ability; they are not a live battle or a fabricated result.",
      },
      {
        question: "What do the status effects mean?",
        answer:
          "Exposure weakens protection; disruption can prevent a special; burn causes damage at the end of a round. Some fighters also use focus, decoys or other passive effects. Their exact values and duration follow the fighter’s ability rules. Use the displayed status and move details rather than assuming every effect stacks or lasts forever.",
      },
      {
        question: "How does a battle end?",
        answer:
          "A fighter at zero health is knocked out. A simultaneous knockout can draw, and a continuing battle that reaches the round limit also draws. The current battle limit is 20 rounds. Healing does not resurrect a knocked-out fighter. A player forfeit or a lifecycle timeout can end an encounter under that mode’s rules.",
      },
      {
        question: "Can I move around the arena or customize my moves?",
        answer:
          "Combat currently uses fixed opposing positions with attack lunges and returns. Free movement, walking controls and configurable combat loadouts are not available. Changing the arena changes the presentation, not your fighter’s stats. The characters are rendered artwork; the app does not present them as fully rigged free-moving models.",
      },
      {
        question: "Does the computer cheat or learn from me?",
        answer:
          "Practice offers Easy, Medium and Hard. The harder policies consider public combat state and recent completed moves; they do not receive hidden stat bonuses. This is game logic, not a claim of machine learning, perfect anti-cheat or human-level play. Change difficulty in setup for a fresh encounter.",
      },
    ],
  },
  {
    id: "modes-matches",
    title: "Modes & player matches",
    intro: "Practice, a friend room, a public series or the sanctuary.",
    questions: [
      {
        question: "What is the difference between the four modes?",
        answer:
          "Practice is a configurable fight against the computer. Find a Match joins the public matchmaking flow. Challenge a Friend creates a private invitation. Story is The Fractured Sanctuary, with exploration, companion interactions, choices and combat. Story and player modes use the holder-access boundary; guest Practice is the starting point when access is unavailable.",
      },
      {
        question: "Is Find a Match ranked, and how long is a series?",
        answer:
          "Public play is unranked. A series targets two battle wins, usually described as best of three; a drawn battle awards no win. Two consecutive draws end the series. Follow the intermission controls for the next battle rather than creating a new room. There is no advertised ranked ladder, matchmaking population guarantee or financial reward.",
      },
      {
        question: "Why am I waiting in the queue?",
        answer:
          "Another eligible player must join and accept a compatible offer. Low activity can mean no opponent is available. Accept before the displayed deadline or cancel if you no longer want to wait. Repeatedly declining offers can temporarily lock queue entry. Opening multiple tabs or refreshing repeatedly does not create an opponent.",
      },
      {
        question: "How do I challenge a friend?",
        answer:
          "Use Challenge a Friend, create an invitation and share its link with the person you want to play. Both players must satisfy the current access checks and complete the room’s selection/readiness steps. Treat invitation and seat-claim links as private: do not publish them or send session cookies to another person. A copied room URL does not transfer your authenticated seat.",
      },
      {
        question: "What happens if I miss a turn, disconnect or close the tab?",
        answer:
          "Player battles have server-side deadlines. A missed selection can receive a legal fallback and repeated misses can forfeit participation; closing a tab does not stop the clock. Return to the same browser and identity promptly and use Resume match if offered. Closing a room before a battle is committed and forfeiting an active battle are different actions; read the confirmation shown.",
      },
      {
        question: "Can I refresh during a player series?",
        answer:
          "The server stores the encounter and series state. Return with the same identity and browser session to resume your seat. A refresh does not reset the score or deadlines, and an expired or finalized encounter cannot be restarted by reloading. If a response is delayed, check the saved state before submitting another action.",
      },
      {
        question:
          "What happens if ownership verification fails during a match?",
        answer:
          "Confirmed loss of official NFT authority ends the affected official participation without inventing a battle win. An unavailable ownership provider follows a pause/expiry path rather than treating the outage as proof that the opponent won. Do not assume every disconnect or access error is an ownership change; the app’s status explains which condition it observed.",
      },
      {
        question: "Does Story use my old adventure save?",
        answer:
          "No. The Fractured Sanctuary has its own combat Story progress. It does not read or overwrite the earlier sandwich adventure, journal, Museum of Bad Decisions or adventure ghosts. Story progress belongs to the relevant private keeper identity; buying a token does not grant access to its previous owner’s private Story session.",
      },
    ],
  },
  {
    id: "progress-privacy",
    title: "Progress & privacy",
    intro: "Know which identity owns a save and what becomes public.",
    questions: [
      {
        question: "Where is my guest progress saved?",
        answer:
          "Battles are stored by the server and associated with your guest browser session. Keep the same site, browser profile and cookies to resume them. Private/incognito sessions and another device have separate cookies. Clearing site data can remove your ability to reach a guest save; do not clear it as a first troubleshooting step. Guest saves are not automatically backed up to your wallet.",
      },
      {
        question: "How do I find past battles or start a rematch?",
        answer:
          "Open Battle History for the current identity, or use the result screen’s history and Rematch actions. A rematch creates a new encounter and preserves the completed result. Holder Practice and Wallet history are distinct entries from guest Practice and guest history; use the same identity that played the battle.",
      },
      {
        question: "Are my results published automatically?",
        answer:
          "Official results are private first. Publication requires the app’s explicit alias and consent flow for the result. Read that preview before sharing. A public token record is separate from wallet-private records and guest results. A private game should not be described as a public verified achievement merely because it was saved.",
      },
      {
        question: "What history follows an NFT to a new owner?",
        answer:
          "Published token-bound history stays associated with that token and retains its historical attribution. Private drafts, wallet/account identifiers, sessions and keeper-private progress do not transfer. The current owner’s authority is verified separately from the authorship of an older record; owning the NFT now does not make you the author of every past result.",
      },
      {
        question:
          "Can a public record change later, and what is a frozen ghost?",
        answer:
          "A ghost or challenge can freeze the version it uses so later changes do not rewrite that attempt’s opponent history. Withdrawal changes current public visibility where the app provides that action, but cannot retract copies someone already downloaded or erase old backups. A stored hash checks integrity; it is not blockchain proof that a player acted honestly or that a score is trustless.",
      },
      {
        question: "Why did I need to sign in again after a domain change?",
        answer:
          "Cookies are scoped to their domain and do not transfer from an old Soryn hostname to playsoryn.tech. Use the canonical HTTPS site and sign in again when required. Guest identity can differ across domains; do not assume an old-domain cookie or a fresh wallet sign-in migrates an earlier guest save.",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting & safety",
    intro: "Recover carefully, without losing a session or sharing secrets.",
    questions: [
      {
        question:
          "The wallet connects, but a mode stays locked. What should I check?",
        answer:
          "Confirm the connected wallet is the one holding the qualifying asset on Monad Mainnet, then use the in-app access refresh or reconnect flow. A marketplace profile, display name or asset on another chain is not current on-chain ownership proof. Read whether the message says insufficient holdings, paused service, expired authentication or unavailable verification; these need different fixes. Do not buy an asset just to diagnose an error.",
      },
      {
        question: "A page or asset fails to load. What should I do first?",
        answer:
          "Check your connection, wait briefly and reload once. Keep the same browser profile and avoid clearing cookies if you need a guest save. If a battle action was interrupted, return to its saved screen and check whether it completed before retrying. Content blockers or wallet extensions can interfere; a separate fresh browser context can help diagnose presentation issues, but it will not contain your existing guest session.",
      },
      {
        question:
          "Why is the homepage background static or the battle motion reduced?",
        answer:
          "The scene normally plays automatically when it is visible. Reduced-motion preferences, Save-Data, autoplay rejection, a video-loading failure or a hidden/off-screen tab can keep the still artwork visible or pause playback. The buttons remain usable while media loads. Motion is presentation; reduced animation does not change the authoritative battle result.",
      },
      {
        question: "Why is there no sound?",
        answer:
          "Use the arena’s audio controls and check the device volume and browser/tab mute setting. Browsers may require a user interaction before playing audio. The homepage ability previews are intentionally silent. Reloading or turning up volume is not a fix for an ownership or authentication error.",
      },
      {
        question:
          "My browser says the connection is not secure. Should I continue?",
        answer:
          "Use https://playsoryn.tech and verify the address carefully. Do not bypass a certificate warning or enter sensitive information on a page with an unresolved security warning. HTTPS validation happens before any www redirect. If the canonical HTTPS address still warns, record the exact hostname and error and report it; a valid certificate alone does not identify every possible browser warning.",
      },
      {
        question:
          "Are there purchases, rewards or on-chain achievement claims?",
        answer:
          "The current app does not offer gameplay purchases, staking, betting, swaps or financial rewards. No token amount is spent to enter a mode. On-chain achievement claims are not part of the current player flow. Do not treat a game result, a token holding or an advertised future feature as a promise of earnings.",
      },
      {
        question: "How should I report a problem?",
        answer:
          "Send the person or channel that gave you access the page URL, approximate time, browser/device, mode, steps to reproduce and the exact error text. Include a screenshot with wallet/account details and private links hidden. Never send seed phrases, private keys, recovery codes, cookies, authentication tokens or full login signatures. This page does not provide a staffed support desk or a guaranteed response time.",
      },
    ],
  },
];
