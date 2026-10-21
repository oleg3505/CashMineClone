# CashMine Payback (Expo / React Native Web)

**Live:** https://cash-mine-clone.expo.app

A phone-first slice of the CashMine app: payback balances, claiming, and activity history.
On first open the app asks for an API token. It is kept only in this browser's localStorage,
and "Change token" on the home screen replaces it.

## Run locally

```bash
npm install
npx expo start --web     # dev server, open at ~390px width
npm test                 # unit tests (vitest)
npm run typecheck
npx expo export --platform web   # static build in dist/
```

The API base URL lives in [src/config.ts](src/config.ts).

## What works

- **Balances**: per-asset available / pending / being-claimed, total in USD, "updated Xs ago"
  (warning when older than 60 s), auto refresh every 15 s, manual refresh, loading, error + retry,
  and a "couldn't refresh, showing older data" state.
- **Claim**: asset picker, amount with Max, inline validation (format, decimals, min, available,
  fee), fee and receive amount, destination, review → confirm, then a live status screen
  (submitted → processing → completed/failed with reason).
- **Safe submission**: one Idempotency-Key per claim, persisted before sending; automatic
  retries with the same key on timeouts/5xx/network errors; 429 Retry-After respected;
  "couldn't confirm" state that survives a page reload.
- **Activity**: infinite-scroll history of accruals, reversals and claims, with refresh and error states.
- **Tests**: amount parsing/formatting, validation, fee/receive, USD totals, balance overlay.

See [NOTES.md](NOTES.md) for decisions and known issues.
