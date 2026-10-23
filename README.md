# Soryn

A browser tactical creature battler with fighters, companions and turn-based battles.

**[Play Soryn](https://playsoryn.tech)** · **[Help & FAQ](https://playsoryn.tech/help)**

## Play

- **Practice:** play against the computer with four free starters. No wallet needed.
- **Find a Match:** join the shared, unranked six-fighter queue. First to two battle wins takes the series.
- **Challenge a Friend:** share an invitation with another eligible player.
- **Story:** explore The Fractured Sanctuary through choices and battles.

Story and multiplayer require a Privy wallet sign-in and at least **500 $CHOG or one Chog NFT** on Monad Mainnet. Neither route spends your assets. NFT holders have the full eligible roster in private play; public matchmaking uses the same six fighters for everyone.

**My Chog** connects an NFT competitor to its consented public history. Current ownership controls NFT-bound writes; private account records do not transfer with the NFT. Results are stored by Soryn, not written into NFT metadata.

## Run locally

Requires Node.js 24.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). Practice works without wallet configuration. For wallet features, configure your own Privy app and Monad RPC using `.env.example`; allow the local origin in Privy. Keep credentials and local databases out of Git.

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

## Built with

Next.js, React, TypeScript, SQLite, Privy and viem. Developed with AI assistance. Soryn is an independent project; its fiction is not official Chog or Monad lore.

## Music

“Legionnaire” by Scott Buckley, released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). [Original track](https://www.scottbuckley.com.au/library/legionnaire-2022/). The game uses an edited, looping excerpt; attribution is also included in the game.
