# Notes

## Decisions

**Amounts: bigint in the asset's smallest unit.** Every amount from the API is parsed once into
a `bigint` count of 10^-decimals and formatted back to a canonical API string for requests
([src/lib/amount.ts](src/lib/amount.ts)). ETH has 18 decimals (`12.345678901234591676`), which a
JS `number` cannot hold. Alternatives: `number` (wrong), or a decimal library like decimal.js/big.js
(fine, but an extra dependency for what is only add/subtract/compare plus one multiply for USD).
USD values are computed exactly, summed in micro-dollars and only rounded to cents for display,
so the total is not a sum of rounded rows. User input is more forgiving than the API format
(`.5`, `5.`, `0,5`, leading zeros) but is normalised before sending; more decimals than the asset
allows is an error rather than silent rounding, because rounding someone's money input is surprising.

**Balance right after a claim: local overlay, reconciled by timestamps.** I asked the AI for options
(see ai-logs): (a) adjust locally until the snapshot catches up, (b) server-only numbers plus a
"claim in progress" banner, (c) show both the snapshot and an "after pending claims" line. I chose (a),
with a deterministic rule instead of a timer: for each claim this device knows about, compare the
claim's `createdAt`/`updatedAt` with the snapshot's `asOf` to work out which state the snapshot
already reflects, and apply only the difference to the claim's current state
([src/lib/balanceOverlay.ts](src/lib/balanceOverlay.ts)). The amount moves from "available" to
"being claimed" immediately (fixes "my balance didn't change, so I claimed again"), and when the new
snapshot arrives the difference becomes zero, so nothing drops and jumps back (fixes the trust
complaint). If a claim fails, the money does come back, but with an explicit "Claim failed: X returned
to available" message, not silently. Max and validation use the adjusted available. Assumption:
a snapshot with `asOf >= claim.createdAt` includes that claim; both are server times, so client
clock skew does not matter. Claims made on other devices are not overlaid; they show up with the next snapshot.

**Unknown claim result: same key, automatic retries, never a second claim.** The Idempotency-Key and
body are persisted to localStorage before the first request ([src/state/claimsStore.ts](src/state/claimsStore.ts)).
Timeouts (15 s client side), 5xx/504 and network errors are "outcome unknown": the app retries with
the same key and backoff (up to 5 attempts; 429 waits `retryAfterMs` and does not count). While this
happens the user sees "Submitting… retries can't create a duplicate", and the claim form is locked.
If retries run out, the user sees "We couldn't confirm your claim. Don't start a new one" with a
"Check again" button that resends the same request. If the page is reloaded, the unresolved
submission is restored and retried. A 4xx means the server definitely did not create the claim, so the
user can edit and resubmit (a new key is generated only then). Alternative: manual retry only. I chose
automatic retries because the server guarantees they are safe and most failures are transient.

**Other decisions**
- Total in USD = available + pending + being claimed (everything earned and not yet paid out), with
  "available to claim now" shown separately.
- Claim status is polled every 2 s until it settles; tracking resumes after a reload.
- Persisted claims are tied to the token, so switching tokens never mixes accounts.
- No router library: the app is five screens with a typed `Route` union in `App.tsx`. I'd move to
  Expo Router for deep links in a real app.
- A 401 anywhere clears the token and returns to the token screen with an explanation.

## Working with AI

All in [ai-logs/](ai-logs/) (Claude Code session export).

1. **A prompt that did not get me what I wanted.** _TODO (fill in honestly from the log)._
2. **AI output that was wrong or risky.** When scaffolding, the agent copied the generated Expo
   project, including its own `.git` folder, over my repo. That silently moved `main` to the
   template's "Initial commit". I found out because a commit was blocked as "commit on protected branch
   main" although we had just created a feature branch. The agent repaired the refs (main back to my
   first commit, branch on top) only after I approved it explicitly. _TODO: add your own view._
3. **Disagreeing with / rejecting a suggestion.** _TODO (fill in honestly from the log)._

## Not done / known issues

- The "unknown outcome" path was only exercised by the code paths and a natural 504 during
  testing; I did not build a fault-injection mode to demo it on purpose. Next: a test for the
  submission state machine with a mocked API (timeout → retry same key → success / exhausted).
- No component/UI tests; tests cover the pure money and overlay logic only.
- If the server stays down, an unresolved submission blocks new claims until it resolves. That is
  intentional, but there is no "I checked Activity, release it" escape hatch yet (it could match
  Activity claim entries by `relatedId`).
- Activity shows amounts as sent by the API (no thousands grouping) and does not live-update.
- Pull-to-refresh gesture is not wired (refresh buttons instead), and there are no accessibility audits or dark mode.
- Assumed the API's `asOf`/`createdAt` share a clock (both server-side).
