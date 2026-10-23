# Soryn

Soryn is a browser tactical creature battler. Choose a fighter and companion, read your opponent, and decide when to attack, defend or use a special ability.

**[Play Soryn](https://playsoryn.tech)** · **[Help & FAQ](https://playsoryn.tech/help)**

## Game modes

| Mode                   | What you do                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Practice**           | Fight the computer with Easy, Medium or Hard difficulty. Four starters are free, with no wallet required.                                    |
| **Find a Match**       | Join a shared, unranked queue against another player. Accept the offer, choose a fighter and ready up. A series is first to two battle wins. |
| **Challenge a Friend** | Create a private invitation and share it with another eligible player.                                                                       |
| **Story**              | Explore The Fractured Sanctuary through choices, companion interactions and battles.                                                         |

Each fighter has Basic Attack, Defence and a distinct Special. Energy, cooldowns, shields and temporary effects influence your next move. Player choices stay hidden until resolution; the server determines the outcome and the animation presents it. Saved battles can resume after refresh.

## Access and fighters

Story and multiplayer require a Privy wallet sign-in and either **at least 500 $CHOG or one verified Chog NFT** on Monad Mainnet. Either holding qualifies independently.

| Access             | Available fighters                                                          |
| ------------------ | --------------------------------------------------------------------------- |
| Guest Practice     | Pip, Bolt, Patch and Moss                                                   |
| 500 $CHOG          | Six fighters: the four starters, Aegis and Nyx                              |
| Chog NFT           | The full eligible roster in private play                                    |
| Public matchmaking | The same six-fighter pool for every eligible entrant, including NFT holders |

Connecting a wallet and completing sign-in are separate steps. Sign-in uses a message signature; it does not require an on-chain transaction, token approval or spending your assets. Holdings do not scale damage, health or initiative.

## Why the NFT matters

**My Chog** lets an owner select a Chog NFT as a persistent competitor identity. The NFT identity is separate from the fighter chosen for a match.

- NFT-bound writes require current-owner verification.
- Official results are private first; publishing uses an explicit consent and alias flow.
- Published token-bound history remains associated with the token after ownership changes, with historical attribution intact.
- Private drafts, wallet sessions and keeper-private progress do not transfer to a new owner.
- Results live in Soryn’s application database; the game does not modify NFT metadata.

Guest history stays separate from wallet and official NFT records. Additional NFT perks are future plans, not promises of currently available features.

## Try it

1. Open [Soryn](https://playsoryn.tech), choose **Play now → Practice**, select a fighter and enter the arena.
2. Try Basic Attack, Defence and Special; check their costs and cooldowns.
3. Refresh during a battle to resume it, then try a rematch or another difficulty.
4. Eligible holders can sign in through **My Chog**, then enter Story, Find a Match or Challenge a Friend. Multiplayer needs another eligible player; the public queue does not insert a computer opponent.

Music starts after interaction. Mute and volume controls are in **More/Menu** and battle settings, and your preferences are remembered.

## Run locally

Requires **Node.js 24** and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open **[http://127.0.0.1:3000](http://127.0.0.1:3000)**, matching the example origin. Guest Practice works without Privy configuration.

For wallet features:

- Set your public Privy app ID in `.env.local`; allow the exact local origin in that Privy app and enable identity tokens.
- Use the same app ID for client and server verification, and configure a Monad Mainnet RPC endpoint.
- The local holder-admission switch defaults to disabled. Set `SORYN_HOLDER_ACCESS=enabled` in your local environment when testing holder entry.
- Keep `APP_ORIGIN` aligned with the URL you open. Never commit credentials, session data or local databases.

See [`.env.example`](.env.example) for the available settings.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run format:check
npm run build
```

Browser tests use Playwright and an isolated fixture RPC:

```sh
npx playwright install chromium
npm run test:e2e
```

Build the app before browser tests. Automated wallet/ownership tests use labelled fixtures; they do not purchase or transfer assets, and real wallet signatures remain human-operated.

## Stack and source

Next.js, React and TypeScript provide the interface and HTTP API. One Node process and SQLite store authoritative battles, series, sessions and progress. Privy handles wallet connection, with server-side authentication and read-only Monad verification through viem.

- `src/app` — pages and API entry points
- `src/components` — interface, artwork playback and music
- `src/domain` — deterministic game rules and shared contracts
- `src/server` — authentication, ownership, orchestration and persistence
- `tests` — unit, integration and browser coverage
- `ops` — deployment configuration

Development and artwork workflows used AI assistance. Soryn is an independent project; its fiction is not official Chog or Monad lore. Game illustrations are separate from NFT collection artwork. There is no staking, betting, custody or financial reward system.

## Music

“Legionnaire” by Scott Buckley, released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). [Original track](https://www.scottbuckley.com.au/library/legionnaire-2022/).

The demo and game use an edited excerpt with loudness normalization and fades; the game loops that excerpt. Attribution is also included in the game and in [`public/music/CREDITS.txt`](public/music/CREDITS.txt).
