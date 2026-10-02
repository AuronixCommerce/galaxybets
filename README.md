# Galaxy Bets

Premium demo-credit casino-style web app using Next.js, Firebase Authentication, Firebase Realtime Database, and server-authoritative game APIs.

## Security note
The Firebase Admin service-account key pasted into chat must be revoked. Create a new key and place it only in server-side environment variables.

## Setup
1. Copy `.env.example` to `.env.local`.
2. Fill in a NEW Firebase Admin service-account email/private key.
3. Enable Email/Password in Firebase Authentication.
4. Publish `database.rules.json` to Firebase Realtime Database.
5. Run `npm install` then `npm run dev`.

## Current implemented foundation
- Firebase Auth client wiring
- Secure Firebase session-cookie bridge
- Server-side UID authorization
- Exact SUPER_ADMIN UID lock
- RTDB private-account transaction model
- Demo wallet with integer units
- Dice server engine + HMAC-SHA256 outcome
- Coinflip server engine + HMAC-SHA256 outcome
- Idempotency protection per account/game request
- Premium responsive casino lobby shell
- Login/register UI
- Admin dashboard shell + server authorization

## Demo credits
1 GC = 100 internal units. New registered accounts are provisioned server-side with 10,000 GC on their first authenticated wallet/game request.
