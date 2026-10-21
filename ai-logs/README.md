# AI logs

Raw Claude Code session exports (`/export`), unedited except that the API token was replaced
with `[REDACTED TOKEN]`. Line numbers below point into
[2026-10-21-084917-pastedcontent-id8967.txt](2026-10-21-084917-pastedcontent-id8967.txt).

| Lines | What happens |
|---|---|
| 5 | I paste the whole task as the prompt. |
| ~150–160 | The agent tries to detect hosting CLIs; my team's plugin blocks it (infra is human-run). |
| 173–180 | **Balance-after-claim decision**: the agent offers three approaches (local overlay until the snapshot catches up / server truth + banner / show both numbers) and two for unknown claim results; I pick the overlay and same-key auto-retry. |
| 187–300 | **Wrong / risky AI output**: copying the Expo scaffold also copied its `.git`, silently moving `main`. Caught when a commit was blocked as "commit on protected branch main"; repaired only after I approved it (line 287). |
| 322–390 | Amount logic as bigint minor units, tests; vitest fails on `expo/tsconfig.base` and is fixed (367). |
| ~849 | Real API check: ETH has 18 decimals, confirming floats are not an option. |
| ~960–1000 | Browser run of the full claim flow and the summary of what I still had to do myself. |
| 1013–end | Housekeeping: stopping the local server, restoring the git remote and pushing. |
