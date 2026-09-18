# Disposable-browser acceptance for CookieKeep 1.1.5

Never use a real browsing profile for these destructive tests. Create a new Chrome/Edge profile with no sign-in/sync, password manager, personal tabs, imported history or other extensions. Load this repository unpacked. Delete that disposable profile after testing using the browser's profile controls.

## Automated coverage already exercised

`scripts/browser-smoke.mjs` loads the actual unpacked extension into a new temporary Edge profile. It does not accept an existing profile path. It needs an existing local Playwright installation, passed as an optional index.mjs path. Run it separately from build/security/hash checks:

```powershell
node scripts/browser-smoke.mjs <path-to-local-playwright-index.mjs>
```

Checks: unrelated same-name cookies, manual A+B consent boundary, Domain parent collision, newly created same-name path collateral, CHIPS protection/deletion, progress recovered after closing the initiating page and real partial cancellation, and native manifest/CSP loading. Cookie values are synthetic and never printed. This is a smoke test, not complete browser certification.

## Synthetic setup from the extension's own DevTools

Open the dashboard in the disposable profile, then its DevTools console. These snippets use extension cookies APIs, not document.cookie; they perform no website navigation. Run them separately. Prefix names with `ck_qa_`. Do not export values or use real service sessions.

```javascript
const setQA = details => chrome.cookies.set({value:'SYNTHETIC_QA_ONLY', path:'/', sameSite:'lax', ...details});
```

```javascript
const sendQA = async message => {const response=await chrome.runtime.sendMessage(message);if(!response.ok)throw new Error(response.error);return response.data;};
```

```javascript
await setQA({url:'http://protected.test/',name:'ck_qa_sid'});
```

```javascript
await setQA({url:'http://tracker.test/',name:'ck_qa_sid'});
```

Protect protected.test in the dashboard. Preview tracker.test; its cookie must remain removable. Confirm and check protected.test remains in the browser's cookie inventory. Only inspect names/domain/path/flags, never dump entire cookie objects.

## Manual matrix

| Case | Fixture / action | Expected |
| --- | --- | --- |
| Independent names | protected.test and tracker.test, both ck_qa_sid | Tracker removable; protected retained |
| Parent Domain collision | Set Domain=.example.test and host-only sub.example.test with the same name; protect example.test | Shared parent retained; ambiguous child operation skipped |
| Host-only parent | Use host-only example.test instead of Domain | Child does not inherit the parent's host-only cookie scope |
| Paths | Same name at /account and /admin; test /acc versus /account | Only selectors whose paths actually match can block each other |
| Root path collateral | Preview a same-name /account cookie, then create a / cookie before confirmation | Old token deletes neither if remove can affect the new root cookie |
| HTTP / Secure | Secure parent Domain and nonsecure child; compare HTTP and HTTPS selectors | Ordinary HTTP excludes Secure cookie; HTTPS includes it; verify trusted loopback separately |
| SameSite | Set distinct Lax, Strict and None+Secure cookies | API handling/policy stays correct; changing flags after preview is skipped |
| Stores | Enable incognito only in this disposable setup, seed equivalent cookies in each accessible store | Separate stores do not collide; API visibility/permission failures fail closed |
| CHIPS | Set partitioned cookies as below, plus the same name unpartitioned and in another partition | Different partitions are separate; potential unpartitioned collateral is guarded |
| Malicious lookalike | example.test, evil-example.test and example.test.evil.test | Label boundaries prevent false protection matches |
| Manual A+B | Preview before.test/A, then create after.test/B | Only A is eligible; B requires another preview |
| Post-preview protection | Preview A, then protect its hostname | A is skipped, never deleted |
| Disappearance / changes | Delete/recreate a cookie or change path/flags/expiry between preview and confirmation | Missing/mismatched/event-invalidated identity is skipped |
| Token expiry / reuse | Wait over ten minutes or reuse an already consumed token | Rejected; new preview required |

CHIPS fixture (Chrome 130+ / equivalent Edge):

```javascript
await setQA({url:'https://chips.test/',name:'ck_qa_chips',secure:true,sameSite:'no_restriction',partitionKey:{topLevelSite:'https://top.test',hasCrossSiteAncestor:true}});
```

Protect top.test; the partitioned chips.test cookie must be retained. Unprotect top.test, regenerate the preview, then confirm deletion. Repeat with a different topLevelSite and hasCrossSiteAncestor=false. Also verify real iframe-set CHIPS using two local HTTPS top-level sites and inspect DevTools Application cookies. API-created CHIPS alone does not cover every frame/SameSite scenario.

## Long-running cleanup, queue and cancellation

Seed at least 1,000 synthetic cookies across many .test domains (Chromium limits per-domain/global cookie counts). Use batches of at most eight `set` calls, not thousands at once. The global cleanup in this profile is destructive by design.

1. Preview and confirm; observe processed/total, percentage and aggregate failures/skips.
2. Close the popup while it is running; reopen it. Progress must come from the worker.
3. Protect a hostname whose cookies have not yet been processed. Protection can wait for the current at-most-eight calls; once saved, future batches must skip it. Already-started removals cannot be undone.
4. Create new cookies during the run. A manual token must not authorize them. New same-selector collateral must cause a skip when observed before the final remove call. Browser APIs cannot guarantee atomicity against a mutation in the final API race window.
5. Cancel. No future removal calls start; in-flight calls settle; the partial summary is retained.
6. Check that cleanup history contains one aggregate record for the run, not one write per cookie.
7. For an automatic three-day schedule, protect a site and create its cookies AFTER scheduling. Trigger the alarm in the disposable profile after advancing its due time through DevTools. Automatic cleanup must read current protection/inventory, not the old preview.

For alarm testing, configure through the UI first. In the extension's worker DevTools, shorten only the disposable alarm's first due time while retaining its three-day period:

```javascript
await chrome.alarms.create('cookiekeep-clean',{when:Date.now()+30000,periodInMinutes:4320});
```

Closing DevTools before the alarm allows normal worker lifecycle behavior; inspect aggregates afterward. Alarms may be delayed by the browser.

## Worker restart and permissions

- Stop the service worker from chrome://extensions or edge://extensions during a long run (DevTools attached can keep it awake). Reopen popup/options to restart it. Session state must show interrupted/failed, never silently resume old identities. Generate a new preview for another manual cleanup.
- Restart the entire browser. Session progress may be gone; local whitelist/schedule/aggregate history must remain. Alarm recovery must not depend on the popup staying open.
- On a fresh install, history must not be required. Select Más visitados, reject the native optional-permission prompt, and verify A-Z/unavailable visits with a retry control. Normal cleanup remains usable.
- Retry, accept, then verify 7/30/90/all periods, default 30 and pagination. Revoke history using browser permission controls (or `chrome.permissions.remove({permissions:['history']})` in extension DevTools), confirm cache clearing and usable dashboard.
- An upgrade can retain a prior history grant; test both fresh install and migration.

## CSP, layout and evidence

Open popup, dashboard and detailed preview in both browsers. Packaged scripts/styles/icons and internal preview navigation must work. Inspect console/extension errors for CSP violations. The hardened CSP is a subresource/connect/form/frame/base restriction, not a guarantee against every browser-API or navigation network action.

Record browser version, OS, fixture sizes, aggregate result, elapsed time, observed concurrency/progress and screenshots without personal data. Mark each manual case passed/failed/not run. Do not report unrun cases as passed. Mock throughput is not real-browser throughput.

## 1.1.3 progress completion regression

The automated smoke also verifies completion with popup and dashboard open: both progress containers become hidden and have zero layout height. Reloading either view after completion keeps progress hidden. Cancellation keeps the partial result in the notice while hiding the progress block. Only running/cancelling states show progress; terminal states stop UI polling.

## Last normal window cleanup

In a disposable profile, choose Al cerrar todas las ventanas in the popup and accept its preview confirmation. Confirm the dashboard select/text change without reload. Save an interval from the dashboard and verify the popup changes, then save closing mode again. No dated next-run text or interval alarm should remain in closing mode.

Create two normal windows and synthetic cookies. Closing the extension popup or an auxiliary window must not add a cleanup record. Closing one normal window must not clean while another remains. Protect a synthetic site after scheduling, then close the final normal window while keeping the browser process running in the background. Only unprotected current cookies may be removed; exactly one aggregate automatic record should be added. Repeat after worker stop/reactivation to exercise the session normal-ID cache. Browser process exit can interrupt cleanup; do not claim completion after the browser has terminated.

Automated UI smoke verifies real Edge selector persistence and bidirectional synchronization. Node tests cover normal/auxiliary events, worker restart, duplicate removal, active-job exclusion and current protection.
