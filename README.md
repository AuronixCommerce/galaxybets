# Galaxy Bets

Galaxy Bets is a responsive, demo-credit gaming platform built with Next.js 16, React 19, Firebase Authentication, Firebase Realtime Database, and server-authoritative game APIs. Galaxy Credits have no cash value; deposits and withdrawals are not implemented.

## Included

- Fifteen playable originals: Dice, Crash, Plinko, Towers, Mines, Hi-Lo, Blackjack, Coinflip, Chicken Road, Limbo, Wheel, Keno, Roulette, Baccarat, and Video Poker
- Email/password registration, verification, password reset, secure five-day server sessions, and sign-out
- Atomic RTDB wallet and game mutations with integer credit units
- Live wallet, active-round, and recent-game projections using Firebase listeners
- HMAC-SHA256 deterministic outcomes, seed commitments, seed rotation, and an instant-game verifier
- Idempotency payload validation, rate limits, age confirmation, cooling-off periods, and demo-credit resets
- Single-UID protected admin area and balance-adjustment API
- Responsive desktop/mobile interface with custom CSS motion and an iOS-style segmented round loader
- PWA manifest, offline fallback, SEO metadata, legal pages, and direct routes for every game

## Firebase and Vercel setup

1. Enable Email/Password in Firebase Authentication.
2. In Firebase Console, generate a new service-account key. Never commit the downloaded JSON or its private key.
3. Add every variable from `.env.example` to Vercel. Replace only `FIREBASE_ADMIN_PRIVATE_KEY` with the real private key and keep its escaped `\\n` line breaks.
4. Publish `database.rules.json` to the Realtime Database. With an authenticated Firebase CLI, run `npx firebase-tools deploy --only database`.
5. Ensure the Firebase Authentication authorized domains include the production Vercel domain.
6. Deploy the `main` branch on Vercel.

The Firebase web API key is intentionally public client configuration. `FIREBASE_ADMIN_PRIVATE_KEY` is the credential that must remain server-only.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Data and security model

One GC equals 100 integer units. A new account begins with 10,000 GC. The browser cannot write wallets, bets, or sessions directly. Authenticated API routes execute the authoritative outcome and mutate the complete private account inside an RTDB transaction. The client may only read its own safe projections; active games never expose mine locations, tower traps, decks, or hidden dealer cards.

This repository is a demo-credit product, not a licensed real-money gambling system.
