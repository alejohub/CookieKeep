# CookieKeep 1.1.2 security and performance review

Baseline: published 1.1.1, commit 1b3424fef3a7bd66dba08e0241461adc7db0b21e. The existing external SECURITY_AUDIT.md is preserved unchanged. Work order: H1, H2, complete tests (94 passed), performance/progress, optional history/CSP, complete tests/build, version/docs/package, normal commit/push.

## H1

Cause: sameRemovalGroup retained unrelated name/store/partition collisions. Policy now checks protected collateral inside the effective remove URL selector: hostOnly versus Domain, label/path boundaries, scheme/Secure, store and partition. Includes possible unpartitioned collateral of a partitioned Chromium deletion conservatively. Localhost/loopback is treated as potentially Secure-accessible over HTTP. Unknown/ambiguous fields fail closed. Tests cover independent domains, parents/children, paths, Secure/HTTP, stores, CHIPS partitions and malicious lookalikes.

## H2

Cause: preview tokens held host/time only, and manual confirmation replanned all current candidates. Tokens now hold metadata identities and scope; manual execution intersects those identities with current candidates/protection and requires every potentially impacted identity to be authorized. New cookies cannot silently expand the confirmation. Tokens expire, are one-use, have a 32-entry bound and are in worker memory only. Cookie-change events invalidate both pending previews and active manual authorization.

Identity: storeId, name, domain, path, hostOnly, Secure, HttpOnly, SameSite, session, expirationDate, and partition topLevelSite/hasCrossSiteAncestor. No value stored. Metadata-only replacements remain indistinguishable without timely change events; APIs offer no atomic get/remove transaction or creation identity. Final external races remain a documented limitation, not hidden behind a formal guarantee. Scope mismatch, invalid/reused/expired tokens, new collateral, disappearance, changed metadata and value-only overwrite events have regression coverage.

Automatic scheduling keeps only interval/next date; the alarm calculates candidates from current inventory/whitelist at run start. It does not reuse a days-old authorization set. Cookies created after scheduling are included; new cookies after run start wait for another run.

## Performance measurement

Original bottleneck: sequential remove/get, storage read and complete policy/inventory recalculation for each cookie, plus another complete inventory afterward. Cookie changes could also cause redundant badge inventories. No intentional deletion sleep or retry loop existed.

New motor: DELETE_CONCURRENCY=8, batches protected by the shared queue, targeted name/store/all-partition inventories, current selector check twice before removal and targeted verification afterward. Overlapping selectors are not started together. Badge inventories are suppressed for deletion change events while a run is active. Aggregate history written once at end.

Measured synthetic benchmark, 1,000 cookies, 1 ms requested latency per API:

| Metric | Sequential global | Bounded targeted (8) |
| --- | ---: | ---: |
| Elapsed ms | 108044.68 | 11714.51 |
| API calls | 9006 | 5131 |
| Global getAll calls | 4002 | 2 |
| Named getAll calls | 0 | 3000 |
| Returned cookie rows | 1001000 | 3000 |
| Storage reads | 1002 | 127 |
| Storage writes | 1 | 1 |
| Max concurrent remove | 1 | 8 |

Approximately 9.22x in this mock. The requested timer latency can be rounded by Windows scheduling. No claim of identical improvement in real browser profiles. The reported 15 cookies/10 seconds on about 3,500 real cookies is a user observation, not measured by this session. Benchmark uses the current H1 policy for both pipelines to isolate the performance architecture.

## Progress, protection and cancellation

Worker owns idle/running/cancelling/completed/failed state with totals, processed/deleted/failed/protected-skip counts, percentage, start time and duration. Engine emits at most every 200 ms at batch boundaries plus start/end; session storage gets throttled aggregate checkpoints. UI polls 250 ms active / 1 second otherwise, not per cookie. Closing UI does not own/cancel the job. Cancellation stops future remove starts and records a partial result; calls in flight finish. Worker restart marks an unfinished checkpoint interrupted/failed and never resumes stale candidates.

Protection updates and batches share a queue. Whitelist is reread before each at-most-eight batch. A requested protection becomes effective when saved after already-started batch calls finish; subsequent batches observe it. This deliberately prioritizes protection correctness over unrestricted parallel writes. External website/browser mutations cannot be transacted atomically with the API.

## History and CSP

history moved to optional_permissions. Permission requested synchronously from selecting visits/retry; load checks contains; refusal and revocation explain A-Z/unavailable data and permit retry. Cleanup, protection, popup and normal dashboard do not require it. URLs are never persisted, and cache remains dashboard memory only. Existing upgrades can retain a previous grant.

CSP: default-src self; script-src self; style-src self; img-src self; object-src none; connect-src none; base-uri none; form-action none; frame-src none. No data/inline/remote resource exception was necessary. Native Edge loading passed. Documentation no longer claims CSP universally prevents all network output; navigation/browser APIs are distinct from covered connection/subresource directives.

## Validation

- 112 Node tests passed, zero failed after changes.
- Real unpacked-extension smoke in headless Edge / new disposable profile passed H1 unrelated collision, H2 A+B and path collateral, Domain parent ambiguity, CHIPS protection/deletion, running progress recovered after closing the initiating page and real partial cancellation and native manifest/CSP loading.
- Forced worker restart, permission prompt/revocation and detailed interactive SameSite/iframe/store behavior remain manual acceptance items in BROWSER_VALIDATION.md. Unit tests cover interrupted checkpoint recovery and optional-permission refusal/revocation.
- No real profile, cookies, history or credentials used. Synthetic values are fixtures, not sensitive user data.
- 1.1.1 published ZIP retained unchanged; only the new 1.1.2 ZIP packages runtime changes.

## Primary API/selector sources consulted

- https://developer.chrome.com/docs/extensions/reference/api/cookies
- https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/extensions/api/cookies/cookies_api.cc
- https://raw.githubusercontent.com/chromium/chromium/main/net/cookies/cookie_deletion_info.cc
- https://raw.githubusercontent.com/chromium/chromium/main/services/network/cookie_manager.cc
- https://developer.chrome.com/docs/extensions/reference/api/permissions
- https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy
