# AI logs

Raw Claude Code session export (`/export`), unedited except that the API token was replaced
with `[REDACTED TOKEN]`. Line numbers below point into
[2026-10-21-092313-pastedcontent-id8967.txt](2026-10-21-092313-pastedcontent-id8967.txt).

| Lines | What happens |
|---|---|
| 6 | I paste the whole task as the prompt. |
| ~150–160 | The agent tries to detect hosting CLIs; my team's plugin blocks it (infra is human-run). |
| 174–181 | **Balance-after-claim decision**: the agent offers three approaches (local overlay until the snapshot catches up / server truth + banner / show both numbers) and two for unknown claim results; I pick the overlay and same-key auto-retry. |
| 188–300 | **Wrong / risky AI output**: copying the Expo scaffold also copied its `.git`, silently moving `main`. Caught when a commit was blocked as "commit on protected branch main"; repaired only after I approved it (line 288). |
| 323–390 | Amount logic as bigint minor units, tests; vitest fails on `expo/tsconfig.base` and is fixed (368). |
| ~850 | Real API check: ETH has 18 decimals, confirming floats are not an option. |
| ~960–1010 | Browser run of the full claim flow and the summary of what I still had to do myself. |
| 1014–1070 | Housekeeping: stopping the local server, restoring the git remote and pushing. |
| 1076–1430 | I report "refresh makes claiming fail". The agent reproduces in a browser, then checks the API and shows the failures were server-side ("destination rejected"), not caused by refresh, but finds a real gap: a failed claim was unexplained on Home. Fixed. |
| 1431–1610 | Activity had no visible refreshing state; fixed and checked with a slowed-down request. |
| 1613–1817 | Refresh button replaced by a "Refreshing…" state on both screens. |
| 1818–end | I ask the agent to make the logs look nicer; it refuses to edit them because the task asks for untidied logs, and only redacts the token. |
