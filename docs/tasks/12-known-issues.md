# 12 — Known issues (not planned)

Goal: record what the manual test of 2026-10-07 found, so it isn't lost. **Not scheduled; we are not fixing these.**

## Manual test, 2026-10-07
Run against the dev server on the real OpenRouter models (default `xiaomi/mimo-v2.6-pro`, fast `google/gemini-3.5-flash-lite`), driving the UI in Chrome; uploads were sent with curl. All 11 e2e specs passed the same day. No console errors.

Worked: choosing the unit for a lease with an unknown unit (R7 FAIL → PASS, flag resolved), a typed lease correction (rent set, rules re-run, conflict flag resolved), a typed issue correction (the agent asked instead of assigning responsibility without a lease), rejecting a work order, the Rejected filter on the unit page, the Unassigned page, the light/dark switch.

### Issues
1. **A failed model call logs no reason.** `openRouterProvider.ts` logs `model <purpose> <model> 0/0 tok <ms>ms error` and rethrows; the API answers 502, but the log never says why (rate limit, timeout, provider error). Seen once on `lease-extraction`; a retry worked.
2. **No timeout on model calls.** One issue-correction turn took 106 s (one call 95 s, 2,758 output tokens). The UI shows "Redrafting the work order…" the whole time with no way to cancel.
3. **A failed lease upload stays in the thread.** The upload that got the 502 kept its file message, so after a retry the file is listed twice.
4. **A unit can be occupied with no lease in effect.** MC-B-1234 (added in Settings as occupied) shows occupied with only a next lease. Occupancy doesn't follow lease dates; see README → Roadmap item 10.
5. **Chrome automation:** screenshots timed out twice on a long lease thread while the page itself kept responding. Likely the browser extension, not the app; noted in case it shows up for a user.

### e2e gaps
No spec yet for: typed corrections (lease and issue), choosing a unit for an unassigned lease, rejecting a work order, adding more photos, the theme switch, the phone menu.
